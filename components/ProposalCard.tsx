'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { zeroAddress } from 'viem'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BaseVoteABI, CONTRACT_ADDRESS, type Proposal } from '@/contracts/BaseVoteABI'
import { APP_NAME, TRACKING_APP_ID } from '@/lib/appConfig'
import { trackTransaction } from '@/utils/track'

type ProposalCardProps = {
  canTransact: boolean
  isConnected: boolean
  isOnBase: boolean
  onActionComplete: () => void
  proposal: Proposal
}

function formatDeadline(deadline: bigint) {
  return new Date(Number(deadline) * 1000).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatCountdown(remainingSeconds: number) {
  if (remainingSeconds <= 0) return '已结束'

  const hours = Math.floor(remainingSeconds / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60

  return `${hours}h ${minutes}m ${seconds}s`
}

export default function ProposalCard({
  canTransact,
  isConnected,
  isOnBase,
  onActionComplete,
  proposal,
}: ProposalCardProps) {
  const { address } = useAccount()
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [pendingVote, setPendingVote] = useState<boolean | null>(null)
  const handledHashRef = useRef<`0x${string}` | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const isEnded = BigInt(now) >= proposal.deadline
  const countdown = formatCountdown(Number(proposal.deadline) - now)

  const {
    data: votedData,
    isLoading: isVoteStateLoading,
    refetch: refetchHasVoted,
  } = useReadContract({
    abi: BaseVoteABI,
    address: CONTRACT_ADDRESS,
    functionName: 'hasVoted',
    args: [BigInt(proposal.id), address ?? zeroAddress],
    query: {
      enabled: Boolean(address),
      refetchInterval: 15000,
    },
  })

  const { data: resultData, refetch: refetchResult } = useReadContract({
    abi: BaseVoteABI,
    address: CONTRACT_ADDRESS,
    functionName: 'getResult',
    args: [BigInt(proposal.id)],
    query: {
      enabled: isEnded,
      refetchInterval: 15000,
    },
  })

  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContract,
  } = useWriteContract()

  const {
    data: receipt,
    error: receiptError,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: Boolean(hash),
    },
  })

  useEffect(() => {
    if (writeError) {
      toast.error(writeError.message || '投票失败。')
      setPendingVote(null)
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      toast.error(receiptError.message || '投票确认失败。')
      setPendingVote(null)
    }
  }, [receiptError])

  useEffect(() => {
    if (!isConfirmed || !receipt?.transactionHash) return
    if (handledHashRef.current === receipt.transactionHash) return

    handledHashRef.current = receipt.transactionHash

    void (async () => {
      if (address) {
        await trackTransaction(TRACKING_APP_ID, APP_NAME, address, receipt.transactionHash)
      }
      toast.success('投票成功，列表已刷新。')
      setPendingVote(null)
      await refetchHasVoted()
      await refetchResult()
      onActionComplete()
      reset()
    })()
  }, [address, isConfirmed, onActionComplete, receipt, refetchHasVoted, refetchResult, reset])

  const hasVoted = Boolean(votedData)
  const isBusy = isPending || isConfirming
  const endedResult = resultData as readonly [bigint, bigint, boolean] | undefined
  const yesVotes = endedResult?.[0] ?? proposal.yesVotes
  const noVotes = endedResult?.[1] ?? proposal.noVotes
  const totalVotes = yesVotes + noVotes
  const yesPercent = totalVotes > 0n ? Number((yesVotes * 100n) / totalVotes) : 0
  const noPercent = totalVotes > 0n ? Number((noVotes * 100n) / totalVotes) : 0
  const resultText = useMemo(() => {
    if (!isEnded) return '投票进行中'
    if (yesVotes === noVotes) return '结果：平票'
    return yesVotes > noVotes ? '结果：Yes 通过' : '结果：No 通过'
  }, [isEnded, noVotes, yesVotes])

  function handleVote(support: boolean) {
    if (!isConnected || !address) {
      toast.error('请先连接钱包。')
      return
    }

    if (!isOnBase) {
      toast.error('当前不是 Base 链，无法投票。')
      return
    }

    if (!proposal.exists) {
      toast.error('提案不存在。')
      return
    }

    if (isEnded) {
      toast.error('投票已结束。')
      return
    }

    if (hasVoted) {
      toast.error('你已经投过票，不能重复投票。')
      return
    }

    setPendingVote(support)
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BaseVoteABI,
      functionName: 'vote',
      args: [BigInt(proposal.id), support],
    })
  }

  return (
    <article className="proposal-card">
      <div className="proposal-card-header">
        <div>
          <span className="eyebrow">Proposal #{proposal.id}</span>
          <h3>{proposal.title}</h3>
          <p className="proposal-description">{proposal.description}</p>
        </div>
        <span className={isEnded ? 'status-pill ended' : 'status-pill live'}>
          {isEnded ? '已结束' : '进行中'}
        </span>
      </div>

      <div className="proposal-meta">
        <p>Deadline: {formatDeadline(proposal.deadline)}</p>
        <p>{isEnded ? '状态：投票结束' : `倒计时：${countdown}`}</p>
      </div>

      <div className="vote-stats-grid">
        <div className="vote-stat yes">
          <span>Yes</span>
          <strong>{yesVotes.toString()}</strong>
          <small>{yesPercent}%</small>
        </div>
        <div className="vote-stat no">
          <span>No</span>
          <strong>{noVotes.toString()}</strong>
          <small>{noPercent}%</small>
        </div>
      </div>

      {hasVoted && !isEnded && (
        <p className="info-banner">已投票提示：当前地址已完成投票，按钮已禁用。</p>
      )}

      {isEnded ? (
        <div className="result-panel">
          <p className="success-banner">{resultText}</p>
          <p className="muted-text">结束后继续展示 yesVotes、noVotes 和最终结果。</p>
        </div>
      ) : (
        <div className="action-row">
          <button
            className="primary-button"
            disabled={!canTransact || isBusy || hasVoted || isVoteStateLoading || isEnded}
            onClick={() => handleVote(true)}
            type="button"
          >
            {isBusy && pendingVote === true ? 'Submitting...' : 'Yes'}
          </button>
          <button
            className="secondary-button"
            disabled={!canTransact || isBusy || hasVoted || isVoteStateLoading || isEnded}
            onClick={() => handleVote(false)}
            type="button"
          >
            {isBusy && pendingVote === false ? 'Submitting...' : 'No'}
          </button>
        </div>
      )}

      {!isConnected && <p className="muted-text">连接钱包后可参与投票。</p>}
      {isConnected && !isOnBase && <p className="warning-text-inline">请切换到 Base 链后再投票。</p>}
      {isEnded && <p className="muted-text">投票结束提示：已结束的提案不再允许投票。</p>}
    </article>
  )
}

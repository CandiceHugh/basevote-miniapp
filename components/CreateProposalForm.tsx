'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BaseVoteABI, CONTRACT_ADDRESS } from '@/contracts/BaseVoteABI'
import { APP_NAME, TRACKING_APP_ID } from '@/lib/appConfig'
import { trackTransaction } from '@/utils/track'

type CreateProposalFormProps = {
  canTransact: boolean
  isConnected: boolean
  isOnBase: boolean
  onCreated: () => void
}

export default function CreateProposalForm({
  canTransact,
  isConnected,
  isOnBase,
  onCreated,
}: CreateProposalFormProps) {
  const { address } = useAccount()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const handledHashRef = useRef<`0x${string}` | null>(null)

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
      toast.error(writeError.message || '创建提案失败。')
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      toast.error(receiptError.message || '提案交易确认失败。')
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
      toast.success('提案创建成功。')
      setTitle('')
      setDescription('')
      setDuration('60')
      onCreated()
      reset()
    })()
  }, [address, isConfirmed, onCreated, receipt, reset])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isConnected || !address) {
      toast.error('请先连接钱包。')
      return
    }

    if (!isOnBase) {
      toast.error('请先切换到 Base 链。')
      return
    }

    if (!title.trim() || !description.trim()) {
      toast.error('标题和描述都不能为空。')
      return
    }

    const parsedDuration = Number(duration)
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      toast.error('持续时间必须是大于 0 的秒数。')
      return
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BaseVoteABI,
      functionName: 'createProposal',
      args: [title.trim(), description.trim(), BigInt(parsedDuration)],
    })
  }

  const isBusy = isPending || isConfirming

  return (
    <section className="panel-card form-panel">
      <div className="section-header">
        <div>
          <span className="eyebrow">Create Proposal</span>
          <h2>发起新提案</h2>
        </div>
        <p className="muted-text">默认持续时间为 60 秒，任何人都可以创建提案。</p>
      </div>

      {!isConnected ? (
        <p className="warning-banner">未连接钱包，暂时无法创建提案。</p>
      ) : !isOnBase ? (
        <p className="warning-banner">当前不是 Base 链，创建按钮已禁用。</p>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>标题</span>
          <input
            disabled={isBusy}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：是否增加社区预算？"
            value={title}
          />
        </label>

        <label>
          <span>描述</span>
          <textarea
            disabled={isBusy}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="填写提案背景、目标和执行方式。"
            rows={5}
            value={description}
          />
        </label>

        <label>
          <span>持续时间（秒）</span>
          <input
            disabled={isBusy}
            min="1"
            onChange={(event) => setDuration(event.target.value)}
            step="1"
            type="number"
            value={duration}
          />
        </label>

        <button className="primary-button" disabled={!canTransact || isBusy} type="submit">
          {isBusy ? 'Submitting...' : '创建提案'}
        </button>
      </form>
    </section>
  )
}

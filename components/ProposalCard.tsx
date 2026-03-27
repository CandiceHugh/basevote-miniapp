'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatEther, parseEther, zeroAddress } from 'viem'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import {
  BasePlayPredictionABI,
  CONTRACT_ADDRESS,
  type PredictionPool,
} from '@/contracts/BasePlayPredictionABI'
import { APP_NAME, TRACKING_APP_ID } from '@/lib/appConfig'
import { trackTransaction } from '@/utils/track'

type ProposalCardProps = {
  canTransact: boolean
  isConnected: boolean
  isOnBase: boolean
  onActionComplete: () => void
  proposal: PredictionPool
}

function formatDeadline(deadline: bigint) {
  return new Date(Number(deadline) * 1000).toLocaleString('en-US', {
    hour12: false,
  })
}

function formatCountdown(remainingSeconds: number) {
  if (remainingSeconds <= 0) return 'Ended'

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
  const [betAmount, setBetAmount] = useState('0.001')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const handledHashRef = useRef<`0x${string}` | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const {
    data: ownerData,
  } = useReadContract({
    abi: BasePlayPredictionABI,
    address: CONTRACT_ADDRESS,
    functionName: 'owner',
    query: {
      refetchInterval: 15000,
    },
  })

  const {
    data: latestPoolData,
    refetch: refetchPool,
  } = useReadContract({
    abi: BasePlayPredictionABI,
    address: CONTRACT_ADDRESS,
    functionName: 'getPool',
    args: [BigInt(proposal.id)],
    query: {
      refetchInterval: 15000,
    },
  })

  const {
    data: userBetState,
    isLoading: isBetStateLoading,
    refetch: refetchBetState,
  } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        abi: BasePlayPredictionABI,
        address: CONTRACT_ADDRESS,
        functionName: 'betA',
        args: [BigInt(proposal.id), address ?? zeroAddress],
      },
      {
        abi: BasePlayPredictionABI,
        address: CONTRACT_ADDRESS,
        functionName: 'betB',
        args: [BigInt(proposal.id), address ?? zeroAddress],
      },
      {
        abi: BasePlayPredictionABI,
        address: CONTRACT_ADDRESS,
        functionName: 'claimed',
        args: [BigInt(proposal.id), address ?? zeroAddress],
      },
    ],
    query: {
      enabled: Boolean(address),
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
      toast.error(writeError.message || 'Transaction failed.')
      setPendingAction(null)
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      toast.error(receiptError.message || 'Transaction confirmation failed.')
      setPendingAction(null)
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
      toast.success('Transaction submitted successfully. The list has been refreshed.')
      setPendingAction(null)
      await refetchBetState()
      await refetchPool()
      onActionComplete()
      reset()
    })()
  }, [address, isConfirmed, onActionComplete, receipt, refetchBetState, refetchPool, reset])

  const poolData =
    (latestPoolData as readonly [string, string, bigint, bigint, bigint, boolean, number] | undefined) ??
    ([proposal.teamA, proposal.teamB, proposal.deadline, proposal.totalA, proposal.totalB, proposal.resolved, proposal.winner] as const)
  const teamA = poolData[0]
  const teamB = poolData[1]
  const deadline = poolData[2]
  const totalA = poolData[3]
  const totalB = poolData[4]
  const resolved = poolData[5]
  const winner = Number(poolData[6])
  const totalPool = totalA + totalB
  const teamAPercent = totalPool > 0n ? Number((totalA * 100n) / totalPool) : 0
  const teamBPercent = totalPool > 0n ? Number((totalB * 100n) / totalPool) : 0
  const isBetClosed = BigInt(now) >= deadline
  const countdown = formatCountdown(Number(deadline) - now)
  const isBusy = isPending || isConfirming
  const isOwner = Boolean(
    address &&
      ownerData &&
      typeof ownerData === 'string' &&
      ownerData.toLowerCase() === address.toLowerCase()
  )
  const betState = userBetState as readonly [bigint, bigint, boolean] | undefined
  const betAAmount = betState?.[0] ?? 0n
  const betBAmount = betState?.[1] ?? 0n
  const alreadyClaimed = Boolean(betState?.[2])
  const hasWinningBet = (winner === 1 && betAAmount > 0n) || (winner === 2 && betBAmount > 0n)

  const resultText = useMemo(() => {
    if (!resolved) {
      return isBetClosed ? 'Betting closed, awaiting result' : 'Betting is active'
    }
    return `Winner: ${winner === 1 ? teamA : teamB}`
  }, [isBetClosed, resolved, teamA, teamB, winner])

  function handleBet(side: 1 | 2) {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isOnBase) {
      toast.error('You are not on Base.')
      return
    }

    if (isBetClosed) {
      toast.error('Betting has closed for this pool.')
      return
    }

    let value: bigint
    try {
      value = parseEther(betAmount)
    } catch {
      toast.error('Enter a valid ETH amount.')
      return
    }

    if (value <= 0n) {
      toast.error('Bet amount must be greater than 0.')
      return
    }

    setPendingAction(side === 1 ? 'betA' : 'betB')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayPredictionABI,
      functionName: 'bet',
      args: [BigInt(proposal.id), side],
      value,
    })
  }

  function handleSetResult(nextWinner: 1 | 2) {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isOnBase) {
      toast.error('You are not on Base.')
      return
    }

    if (!isOwner) {
      toast.error('Only the owner can set the result.')
      return
    }

    setPendingAction(nextWinner === 1 ? 'resolveA' : 'resolveB')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayPredictionABI,
      functionName: 'setResult',
      args: [BigInt(proposal.id), nextWinner],
    })
  }

  function handleClaim() {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isOnBase) {
      toast.error('You are not on Base.')
      return
    }

    if (!hasWinningBet) {
      toast.error('No winning bet to claim.')
      return
    }

    setPendingAction('claim')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayPredictionABI,
      functionName: 'claim',
      args: [BigInt(proposal.id)],
    })
  }

  return (
    <article className="proposal-card">
      <div className="proposal-card-header">
        <div>
          <span className="eyebrow">Pool #{proposal.id}</span>
          <h3>{teamA} vs {teamB}</h3>
          <p className="proposal-description">Pick the winning team, place an ETH bet before the deadline, and claim after the result is set.</p>
        </div>
        <span className={resolved ? 'status-pill ended' : 'status-pill live'}>
          {resolved ? 'Resolved' : isBetClosed ? 'Awaiting Result' : 'Open'}
        </span>
      </div>

      <div className="proposal-meta">
        <p>Deadline: {formatDeadline(deadline)}</p>
        <p>{resolved ? 'Status: result set' : isBetClosed ? 'Status: betting closed' : `Countdown: ${countdown}`}</p>
        <p>Total Pool: {formatEther(totalPool)} ETH</p>
      </div>

      <div className="vote-stats-grid">
        <div className="vote-stat yes">
          <span>{teamA}</span>
          <strong>{formatEther(totalA)} ETH</strong>
          <small>{teamAPercent}%</small>
        </div>
        <div className="vote-stat no">
          <span>{teamB}</span>
          <strong>{formatEther(totalB)} ETH</strong>
          <small>{teamBPercent}%</small>
        </div>
      </div>

      {!!address && (
        <p className="info-banner">
          Your bets: {teamA} {formatEther(betAAmount)} ETH, {teamB} {formatEther(betBAmount)} ETH
          {alreadyClaimed ? ' | Already claimed' : ''}
        </p>
      )}

      {resolved ? (
        <div className="result-panel">
          <p className="success-banner">{resultText}</p>
          <p className="muted-text">Resolved pools remain visible for claiming and final review.</p>
          <button
            className="primary-button"
            disabled={!canTransact || isBusy || !hasWinningBet || alreadyClaimed}
            onClick={handleClaim}
            type="button"
          >
            {isBusy && pendingAction === 'claim'
              ? 'Submitting...'
              : alreadyClaimed
                ? 'Already Claimed'
                : 'Claim Reward'}
          </button>
        </div>
      ) : !isBetClosed ? (
        <div className="action-stack">
          <input
            className="bet-amount-input"
            disabled={isBusy}
            min="0"
            onChange={(event) => setBetAmount(event.target.value)}
            placeholder="Bet amount in ETH"
            step="0.0001"
            type="number"
            value={betAmount}
          />
          <div className="action-row">
            <button
              className="primary-button"
              disabled={!canTransact || isBusy || isBetStateLoading}
              onClick={() => handleBet(1)}
              type="button"
            >
              {isBusy && pendingAction === 'betA' ? 'Submitting...' : `Bet ${teamA}`}
            </button>
            <button
              className="secondary-button"
              disabled={!canTransact || isBusy || isBetStateLoading}
              onClick={() => handleBet(2)}
              type="button"
            >
              {isBusy && pendingAction === 'betB' ? 'Submitting...' : `Bet ${teamB}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="result-panel">
          <p className="warning-banner">{resultText}</p>
          {isOwner ? (
            <div className="action-row">
              <button
                className="primary-button"
                disabled={!canTransact || isBusy}
                onClick={() => handleSetResult(1)}
                type="button"
              >
                {isBusy && pendingAction === 'resolveA' ? 'Submitting...' : `Set ${teamA} Winner`}
              </button>
              <button
                className="secondary-button"
                disabled={!canTransact || isBusy}
                onClick={() => handleSetResult(2)}
                type="button"
              >
                {isBusy && pendingAction === 'resolveB' ? 'Submitting...' : `Set ${teamB} Winner`}
              </button>
            </div>
          ) : (
            <p className="muted-text">Waiting for the owner to set the result.</p>
          )}
        </div>
      )}

      {!isConnected && <p className="muted-text">Connect your wallet to place bets and claim rewards.</p>}
      {isConnected && !isOnBase && <p className="warning-text-inline">Switch to Base before transacting.</p>}
      {isBetClosed && !resolved && <p className="muted-text">Betting has ended. Only result settlement is available now.</p>}
    </article>
  )
}

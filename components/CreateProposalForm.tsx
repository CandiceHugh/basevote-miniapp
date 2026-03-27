'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BasePlayPredictionABI, CONTRACT_ADDRESS } from '@/contracts/BasePlayPredictionABI'
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
  const { data: ownerData } = useReadContract({
    abi: BasePlayPredictionABI,
    address: CONTRACT_ADDRESS,
    functionName: 'owner',
  })
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [deadline, setDeadline] = useState(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
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
  const isOwner =
    Boolean(address) &&
    typeof ownerData === 'string' &&
    ownerData.toLowerCase() === address?.toLowerCase()

  useEffect(() => {
    if (writeError) {
      toast.error(writeError.message || 'Failed to create pool.')
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      toast.error(receiptError.message || 'Pool transaction confirmation failed.')
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
      toast.success('Pool created successfully.')
      setTeamA('')
      setTeamB('')
      const date = new Date(Date.now() + 60 * 60 * 1000)
      setDeadline(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
      onCreated()
      reset()
    })()
  }, [address, isConfirmed, onCreated, receipt, reset])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isConnected || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isOnBase) {
      toast.error('Switch to Base first.')
      return
    }

    if (!isOwner) {
      toast.error('Only the owner can create pools.')
      return
    }

    if (!teamA.trim() || !teamB.trim()) {
      toast.error('Both team names are required.')
      return
    }

    const parsedDeadline = Math.floor(new Date(deadline).getTime() / 1000)
    if (!Number.isFinite(parsedDeadline) || parsedDeadline <= Math.floor(Date.now() / 1000)) {
      toast.error('Deadline must be in the future.')
      return
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayPredictionABI,
      functionName: 'createPool',
      args: [teamA.trim(), teamB.trim(), BigInt(parsedDeadline)],
    })
  }

  const isBusy = isPending || isConfirming

  return (
    <section className="panel-card form-panel">
      <div className="section-header">
        <div>
          <span className="eyebrow">Create Pool</span>
          <h2>Create a New Match Pool</h2>
        </div>
        <p className="muted-text">Enter the two teams and a future deadline to open a new prediction pool.</p>
      </div>

      {!isConnected ? (
        <p className="warning-banner">Wallet not connected. You cannot create a pool yet.</p>
      ) : !isOnBase ? (
        <p className="warning-banner">You are not on Base. The create button is disabled.</p>
      ) : !isOwner ? (
        <p className="warning-banner">Only the contract owner can create new pools.</p>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>Team A</span>
          <input
            disabled={isBusy}
            onChange={(event) => setTeamA(event.target.value)}
            placeholder="Example: Lakers"
            value={teamA}
          />
        </label>

        <label>
          <span>Team B</span>
          <input
            disabled={isBusy}
            onChange={(event) => setTeamB(event.target.value)}
            placeholder="Example: Celtics"
            value={teamB}
          />
        </label>

        <label>
          <span>Deadline</span>
          <input
            disabled={isBusy}
            onChange={(event) => setDeadline(event.target.value)}
            type="datetime-local"
            value={deadline}
          />
        </label>

        <button className="primary-button" disabled={!canTransact || isBusy || !isOwner} type="submit">
          {isBusy ? 'Submitting...' : 'Create Pool'}
        </button>
      </form>
    </section>
  )
}

'use client'

import { useEffect, useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import {
  BasePlayPredictionABI,
  CONTRACT_ADDRESS,
  type PredictionPool,
} from '@/contracts/BasePlayPredictionABI'
import ProposalCard from './ProposalCard'

type ProposalListProps = {
  canTransact: boolean
  isConnected: boolean
  isOnBase: boolean
  onActionComplete: () => void
  refreshKey: number
}

export default function ProposalList({
  canTransact,
  isConnected,
  isOnBase,
  onActionComplete,
  refreshKey,
}: ProposalListProps) {
  const {
    data: poolCount,
    error: countError,
    isLoading: isCountLoading,
    refetch: refetchCount,
  } = useReadContract({
    abi: BasePlayPredictionABI,
    address: CONTRACT_ADDRESS,
    functionName: 'poolCount',
    query: {
      refetchInterval: 15000,
    },
  })

  const ids = useMemo(
    () => Array.from({ length: Number(poolCount ?? 0n) }, (_, index) => BigInt(index + 1)),
    [poolCount]
  )

  const {
    data: poolsData,
    error: proposalsError,
    isLoading: isProposalsLoading,
    refetch: refetchProposals,
  } = useReadContracts({
    allowFailure: true,
    contracts: ids.map((id) => ({
      abi: BasePlayPredictionABI,
      address: CONTRACT_ADDRESS,
      functionName: 'getPool' as const,
      args: [id],
    })),
    query: {
      enabled: ids.length > 0,
      refetchInterval: 15000,
    },
  })

  useEffect(() => {
    void refetchCount()
    void refetchProposals()
  }, [refreshKey, refetchCount, refetchProposals])

  const proposals = useMemo(() => {
    if (!poolsData) return []

    return poolsData
      .map((item, index) => {
        if (item.status !== 'success') return null
        const result = item.result as readonly [string, string, bigint, bigint, bigint, boolean, number]
        const proposal: PredictionPool = {
          id: Number(ids[index]),
          teamA: result[0],
          teamB: result[1],
          deadline: result[2],
          totalA: result[3],
          totalB: result[4],
          resolved: result[5],
          winner: Number(result[6]),
        }
        return proposal
      })
      .filter(Boolean)
      .reverse() as PredictionPool[]
  }, [ids, poolsData])

  function handleRefresh() {
    void refetchCount()
    void refetchProposals()
    onActionComplete()
  }

  return (
    <section className="panel-card list-panel">
      <div className="section-header list-header">
        <div>
          <span className="eyebrow">Pool List</span>
          <h2>Onchain Prediction Pools</h2>
          <p className="muted-text">Read pools live from the contract and show the newest first.</p>
        </div>
        <button className="secondary-button" onClick={handleRefresh} type="button">
          Refresh
        </button>
      </div>

      {!isConnected ? (
        <p className="warning-banner">Wallet not connected. You can browse pools but cannot bet or create.</p>
      ) : !isOnBase ? (
        <p className="warning-banner">You are not on Base. Betting and creation are disabled.</p>
      ) : (
        <p className="success-banner">Connected to Base. You can bet on open pools and claim resolved wins.</p>
      )}

      {(countError || proposalsError) && (
        <p className="error-banner">Failed to load pools. Make sure the Base contract is reachable.</p>
      )}

      {(isCountLoading || isProposalsLoading) && (
        <p className="loading-banner">Loading pools from the chain...</p>
      )}

      {!isCountLoading && !countError && proposals.length === 0 && (
        <p className="empty-banner">No pools yet. Create the first pool to get started.</p>
      )}

      <div className="proposal-stack">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            canTransact={canTransact}
            isConnected={isConnected}
            isOnBase={isOnBase}
            onActionComplete={handleRefresh}
            proposal={proposal}
          />
        ))}
      </div>
    </section>
  )
}

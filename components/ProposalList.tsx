'use client'

import { useEffect, useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { BaseVoteABI, CONTRACT_ADDRESS, type Proposal } from '@/contracts/BaseVoteABI'
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
    data: proposalCount,
    error: countError,
    isLoading: isCountLoading,
    refetch: refetchCount,
  } = useReadContract({
    abi: BaseVoteABI,
    address: CONTRACT_ADDRESS,
    functionName: 'proposalCount',
    query: {
      refetchInterval: 15000,
    },
  })

  const ids = useMemo(
    () => Array.from({ length: Number(proposalCount ?? 0n) }, (_, index) => BigInt(index + 1)),
    [proposalCount]
  )

  const {
    data: proposalsData,
    error: proposalsError,
    isLoading: isProposalsLoading,
    refetch: refetchProposals,
  } = useReadContracts({
    allowFailure: true,
    contracts: ids.map((id) => ({
      abi: BaseVoteABI,
      address: CONTRACT_ADDRESS,
      functionName: 'proposals' as const,
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
    if (!proposalsData) return []

    return proposalsData
      .map((item, index) => {
        if (item.status !== 'success') return null
        const result = item.result as readonly [string, string, bigint, bigint, bigint, boolean]
        const proposal: Proposal = {
          id: Number(ids[index]),
          title: result[0],
          description: result[1],
          deadline: result[2],
          yesVotes: result[3],
          noVotes: result[4],
          exists: result[5],
        }
        return proposal.exists ? proposal : null
      })
      .filter(Boolean)
      .reverse() as Proposal[]
  }, [ids, proposalsData])

  function handleRefresh() {
    void refetchCount()
    void refetchProposals()
    onActionComplete()
  }

  return (
    <section className="panel-card list-panel">
      <div className="section-header list-header">
        <div>
          <span className="eyebrow">Proposal List</span>
          <h2>链上提案</h2>
          <p className="muted-text">从合约实时读取提案，按最新创建顺序倒序展示。</p>
        </div>
        <button className="secondary-button" onClick={handleRefresh} type="button">
          刷新列表
        </button>
      </div>

      {!isConnected ? (
        <p className="warning-banner">未连接钱包，可以浏览提案，但不能创建和投票。</p>
      ) : !isOnBase ? (
        <p className="warning-banner">当前不是 Base 链，投票和创建入口已禁用。</p>
      ) : (
        <p className="success-banner">已连接 Base，可对未结束提案进行投票。</p>
      )}

      {(countError || proposalsError) && (
        <p className="error-banner">读取提案失败，请确认当前网络可访问 Base 合约。</p>
      )}

      {(isCountLoading || isProposalsLoading) && (
        <p className="loading-banner">正在从链上加载提案列表...</p>
      )}

      {!isCountLoading && !countError && proposals.length === 0 && (
        <p className="empty-banner">当前还没有提案，创建第一个提案开始治理吧。</p>
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

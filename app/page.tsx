'use client'

import { useMemo, useState } from 'react'
import { base } from 'wagmi/chains'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import CreateProposalForm from '@/components/CreateProposalForm'
import ProposalList from '@/components/ProposalList'
import { CONTRACT_ADDRESS } from '@/contracts/BaseVoteABI'
import { APP_NAME, BUILDER_CODE, BUILDER_HEX } from '@/lib/appConfig'

export default function HomePage() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [refreshKey, setRefreshKey] = useState(0)

  const isOnBase = chainId === base.id
  const shortAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  function refreshProposals() {
    setRefreshKey((value) => value + 1)
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Governance Mini App</span>
          <h1>{APP_NAME}</h1>
          <p>
            基于 Base 的链上治理投票系统，支持真实读取提案、创建提案、
            对进行中的提案投 Yes / No，并在交易成功后自动刷新结果。
          </p>

          <div className="hero-meta-grid">
            <div className="hero-meta-card">
              <span>Contract</span>
              <strong>{CONTRACT_ADDRESS}</strong>
            </div>
            <div className="hero-meta-card">
              <span>BuilderCode</span>
              <strong>{BUILDER_CODE}</strong>
              <small>{BUILDER_HEX}</small>
            </div>
          </div>
        </div>

        <div className="wallet-panel">
          {!isConnected ? (
            <>
              <p className="panel-title">连接钱包后即可创建提案和投票</p>
              <div className="button-stack">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    className="primary-button"
                    disabled={isConnecting}
                    onClick={() => connect({ connector })}
                    type="button"
                  >
                    {isConnecting ? 'Connecting...' : `Connect ${connector.name}`}
                  </button>
                ))}
              </div>
              <p className="warning-text">未连接钱包，交易按钮将保持禁用。</p>
            </>
          ) : (
            <>
              <p className="panel-title">已连接钱包</p>
              <p className="address-pill">{shortAddress}</p>
              {isOnBase ? (
                <p className="success-text">当前网络为 Base，可直接创建提案和投票。</p>
              ) : (
                <>
                  <p className="warning-text">当前不是 Base 链，交易入口已禁用。</p>
                  <button
                    className="primary-button"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: base.id })}
                    type="button"
                  >
                    {isSwitching ? 'Switching...' : 'Switch To Base'}
                  </button>
                </>
              )}
              <button className="secondary-button" onClick={() => disconnect()} type="button">
                Disconnect
              </button>
            </>
          )}
        </div>
      </section>

      <section className="content-grid governance-grid">
        <CreateProposalForm
          canTransact={Boolean(isConnected && isOnBase)}
          isConnected={isConnected}
          isOnBase={isOnBase}
          onCreated={refreshProposals}
        />
        <ProposalList
          canTransact={Boolean(isConnected && isOnBase)}
          isConnected={isConnected}
          isOnBase={isOnBase}
          onActionComplete={refreshProposals}
          refreshKey={refreshKey}
        />
      </section>
    </main>
  )
}

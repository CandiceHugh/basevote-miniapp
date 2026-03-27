'use client'

import { useMemo, useState } from 'react'
import { base } from 'wagmi/chains'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import CreateProposalForm from '@/components/CreateProposalForm'
import ProposalList from '@/components/ProposalList'
import { CONTRACT_ADDRESS } from '@/contracts/BasePlayPredictionABI'
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
            Create prediction pools on Base, bet on either team with ETH, and
            track results live from the contract. The page refreshes
            automatically after successful transactions.
          </p>

          <div className="hero-meta-grid">
            <div className="hero-meta-card">
              <span>Contract</span>
              <strong>{CONTRACT_ADDRESS}</strong>
            </div>
            <div className="hero-meta-card">
              <span>Builder Code</span>
              <strong>{BUILDER_CODE}</strong>
              <small>{BUILDER_HEX}</small>
            </div>
          </div>
        </div>

        <div className="wallet-panel">
          {!isConnected ? (
            <>
              <p className="panel-title">Connect your wallet to create pools, bet, and claim</p>
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
              <p className="warning-text">Wallet not connected. Transaction buttons are disabled.</p>
            </>
          ) : (
            <>
            <p className="panel-title">Connected Wallet</p>
            <p className="address-pill">{shortAddress}</p>
            {isOnBase ? (
                <p className="success-text">You are on Base and ready to create pools, bet, and claim.</p>
            ) : (
                <>
                  <p className="warning-text">You are not on Base. Transactions are disabled.</p>
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

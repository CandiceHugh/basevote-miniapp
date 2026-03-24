'use client'

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESS, ABI } from '@/contracts/BasePlayABI'
import { parseEther, formatEther } from 'viem'
import { useState, useEffect } from 'react'
import { trackTransaction } from '@/utils/track'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()
  
  const [poolCount, setPoolCount] = useState(0)
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [txHash, setTxHash] = useState('')

  const { data: poolCountData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'poolCount',
  })

  const { data: ownerData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'owner',
  })

  const isOwner = address && ownerData && address.toLowerCase() === (ownerData as string).toLowerCase()

  useEffect(() => {
    if (poolCountData) {
      setPoolCount(Number(poolCountData))
    }
  }, [poolCountData])

  useEffect(() => {
    const fetchPools = async () => {
      const poolsData = []
      for (let i = 0; i < poolCount; i++) {
        try {
          const response = await fetch(`/api/pool?id=${i}`)
          const data = await response.json()
          poolsData.push({ id: i, ...data })
        } catch (e) {
          console.error(e)
        }
      }
      setPools(poolsData)
    }
    if (poolCount > 0) {
      fetchPools()
    }
  }, [poolCount])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 5000)
  }

  const handleCreatePool = async () => {
    if (!isConnected) {
      showToast('Please connect wallet')
      return
    }
    setLoading(true)
    try {
      const description = prompt('Pool description (e.g., Team A vs Team B)')
      if (!description) {
        setLoading(false)
        return
      }
      const deadline = Math.floor(Date.now() / 1000) + 60 // 60 seconds from now
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'createPool',
        args: [description, BigInt(deadline)],
      })
      
      setTxHash(hash)
      await trackTransaction('app-001', 'BasePlay', address, hash)
      showToast(`Pool created! TX: ${hash.slice(0, 10)}...`)
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      showToast(`Error: ${e.message || 'Transaction failed'}`)
    }
    setLoading(false)
  }

  const handleBet = async (poolId: number, outcome: number) => {
    if (!isConnected) {
      showToast('Please connect wallet')
      return
    }
    setLoading(true)
    try {
      const amount = prompt('Bet amount in ETH (e.g., 0.01)')
      if (!amount) {
        setLoading(false)
        return
      }
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'bet',
        args: [BigInt(poolId), outcome],
        value: parseEther(amount),
      })
      
      setTxHash(hash)
      await trackTransaction('app-001', 'BasePlay', address, hash)
      showToast(`Bet placed! TX: ${hash.slice(0, 10)}...`)
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      showToast(`Error: ${e.message || 'Transaction failed'}`)
    }
    setLoading(false)
  }

  const handleClaim = async (poolId: number) => {
    if (!isConnected) {
      showToast('Please connect wallet')
      return
    }
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'claim',
        args: [BigInt(poolId)],
      })
      
      setTxHash(hash)
      await trackTransaction('app-001', 'BasePlay', address, hash)
      showToast(`Claimed! TX: ${hash.slice(0, 10)}...`)
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      showToast(`Error: ${e.message || 'Transaction failed'}`)
    }
    setLoading(false)
  }

  const handleResolve = async (poolId: number) => {
    if (!isConnected || !isOwner) return
    setLoading(true)
    try {
      const result = prompt('Result: 1=Home, 2=Away, 3=Draw')
      if (!result || !['1', '2', '3'].includes(result)) {
        setLoading(false)
        return
      }
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'resolve',
        args: [BigInt(poolId), Number(result)],
      })
      
      setTxHash(hash)
      await trackTransaction('app-001', 'BasePlay', address, hash)
      showToast(`Pool resolved! TX: ${hash.slice(0, 10)}...`)
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      showToast(`Error: ${e.message || 'Transaction failed'}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">BasePlay</h1>
          <div className="flex gap-4 items-center">
            {!isConnected ? (
              <div className="flex gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  >
                    Connect {connector.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 items-center">
                <span className="text-sm text-gray-400">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button
                  onClick={() => disconnect()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Prediction Pools</h2>
            <p className="text-gray-400">Bet on sports outcomes and win rewards</p>
          </div>
          {isOwner && (
            <button
              onClick={handleCreatePool}
              disabled={loading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition font-medium disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Create Pool'}
            </button>
          )}
        </div>

        {pools.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl">No pools yet</p>
            {isOwner && <p className="mt-2">Create the first pool to get started</p>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {pools.map((pool) => (
              <div key={pool.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{pool.description}</h3>
                    <p className="text-sm text-gray-400">Pool #{pool.id}</p>
                  </div>
                  {pool.resolved ? (
                    <span className="px-3 py-1 bg-purple-600 rounded-full text-sm">
                      Resolved
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-600 rounded-full text-sm">
                      Active
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Pool:</span>
                    <span className="font-medium">{formatEther(BigInt(pool.totalBets || 0))} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Home:</span>
                    <span>{formatEther(BigInt(pool.homeBets || 0))} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Away:</span>
                    <span>{formatEther(BigInt(pool.awayBets || 0))} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Draw:</span>
                    <span>{formatEther(BigInt(pool.drawBets || 0))} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Deadline:</span>
                    <span>{new Date(pool.deadline * 1000).toLocaleString()}</span>
                  </div>
                </div>

                {!pool.resolved ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleBet(pool.id, 1)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition text-sm disabled:opacity-50"
                      >
                        Bet Home
                      </button>
                      <button
                        onClick={() => handleBet(pool.id, 2)}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition text-sm disabled:opacity-50"
                      >
                        Bet Away
                      </button>
                      <button
                        onClick={() => handleBet(pool.id, 3)}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition text-sm disabled:opacity-50"
                      >
                        Bet Draw
                      </button>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleResolve(pool.id)}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition text-sm disabled:opacity-50"
                      >
                        Resolve Pool (Owner)
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(pool.id)}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Claim Winnings'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 px-6 py-4 rounded-lg shadow-lg max-w-md">
          <p className="text-sm">{toast}</p>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs mt-2 block"
            >
              View on BaseScan →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

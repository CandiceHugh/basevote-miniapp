import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { CONTRACT_ADDRESS, ABI } from '@/contracts/BasePlayABI'

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id === null) {
      return NextResponse.json({ error: 'Missing pool id' }, { status: 400 })
    }

    const data = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'getPool',
      args: [BigInt(id)],
    }) as unknown as any[]

    return NextResponse.json({
      description: data[0],
      deadline: Number(data[1]),
      totalBets: data[2].toString(),
      homeBets: data[3].toString(),
      awayBets: data[4].toString(),
      drawBets: data[5].toString(),
      result: Number(data[6]),
      resolved: data[7],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

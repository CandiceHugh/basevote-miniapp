const DASHBOARD_API = 'https://base-dashboard-zeta.vercel.app/api/track'

export async function trackTransaction(
  appId: string,
  appName: string,
  userAddress: string | undefined,
  txHash: string
) {
  try {
    await fetch(DASHBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_name: appName,
        user_address: userAddress?.toLowerCase(),
        tx_hash: txHash,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Silent fail
  }
}

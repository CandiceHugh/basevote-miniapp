import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://baseplay.vercel.app'),
  title: 'BasePlay',
  description: 'Prediction market on Base',
  openGraph: {
    title: 'BasePlay',
    description: 'Prediction market on Base',
    url: 'https://baseplay.vercel.app',
    siteName: 'BasePlay',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69c0b55d3beb94a927e63d55" />
        <meta name="talentapp:project_verification" content="4a7fa9b0d878fcc46a71871a111b21cadbbb0f420867fb883105a57d0e39cf183bf1ff06ba079dbd84a8a61e9795e4ebfd7b9203fcba763ca57c378d758aaa97" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

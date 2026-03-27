import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { BASE_APP_ID, PROJECT_VERIFICATION, SITE_URL } from '@/lib/appConfig'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'BaseVote',
  description: 'An onchain prediction pool mini app built on Base',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'BaseVote',
    description: 'An onchain prediction pool mini app built on Base',
    url: SITE_URL,
    images: ['/og.png'],
  },
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content={BASE_APP_ID} />
        <meta name="talentapp:project_verification" content={PROJECT_VERIFICATION} />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </Providers>
      </body>
    </html>
  )
}

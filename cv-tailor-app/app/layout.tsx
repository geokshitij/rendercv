import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareerCraft',
  description: 'Success is where preparation and opportunity meet. — Bobby Unser',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


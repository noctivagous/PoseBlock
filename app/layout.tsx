import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PoseBlock',
  description: 'Pose a 3D human over a video frame and export PNG for AI video tools',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from './providers'

export const metadata: Metadata = {
  title: "Pi Que. - YouTube 구간 편집기",
  description: "YouTube 영상을 구간별로 편집하고 재생하는 도구",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pretendard:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-pretendard">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

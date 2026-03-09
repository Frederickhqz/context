import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevent zoom on mobile for app-like feel
  viewportFit: "cover", // iOS safe areas
};

export const metadata: Metadata = {
  title: "Context",
  description: "Your second brain for notes, ideas, and connections",
  keywords: ["notes", "knowledge management", "semantic search", "timeline", "MCP", "AI", "beats", "mesh"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Context",
    description: "Your second brain for notes, ideas, and connections",
    type: "website",
    images: ["/og-image.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Context",
    description: "Your second brain for notes, ideas, and connections",
    images: ["/og-image.svg"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Context",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Prevent iOS pull-to-refresh in standalone mode */}
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* Theme colors for browser chrome */}
        <meta name="msapplication-TileColor" content="#6366F1" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(console.error);
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
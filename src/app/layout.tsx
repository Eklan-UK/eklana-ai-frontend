import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { FCMNotificationListener } from "@/components/notifications/FCMNotificationListener";

export const metadata: Metadata = {
  title: "Eklan - Create Your Future",
  description: "Make English speaking feel natural with AI-powered practice",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Eklan",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Eklan",
    title: "Eklan - Create Your Future",
    description: "Make English speaking feel natural with AI-powered practice",
  },
  twitter: {
    card: "summary",
    title: "Eklan - Create Your Future",
    description: "Make English speaking feel natural with AI-powered practice",
  },
  icons: {
    icon: [
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo2.png", type: "image/png" },
    ],
    shortcut: "/icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-satoshi" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider />
            <FCMNotificationListener />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

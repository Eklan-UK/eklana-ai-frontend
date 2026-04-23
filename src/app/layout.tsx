import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
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
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icon.png",
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
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const key = "theme";
              const stored = localStorage.getItem(key);
              const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
              const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
              document.documentElement.classList.toggle("dark", resolved === "dark");
              document.documentElement.setAttribute("data-theme", resolved);
            } catch (_) {}
          })();`}
        </Script>
      </head>
      <body className="antialiased font-satoshi" suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <ToastProvider />
              <FCMNotificationListener />
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

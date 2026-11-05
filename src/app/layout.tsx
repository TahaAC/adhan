import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Amiri, Reem_Kufi } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const amiri = Amiri({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const reemKufi = Reem_Kufi({
  variable: "--font-kufi",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Shia Azan — Prayer Times & Adhan",
  description:
    "Shia prayer times (Tehran / Jafari method) with countdown to the next salat, azan notifications, Hijri date and Qibla direction. Installable on desktop and mobile.",
  keywords: [
    "Shia",
    "Azan",
    "Adhan",
    "Prayer Times",
    "Salat",
    "Namaz",
    "Tehran method",
    "Jafari",
    "Hijri",
    "Qibla",
    "PWA",
  ],
  authors: [{ name: "Shia Azan" }],
  applicationName: "Shia Azan",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shia Azan",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon-32.png"],
  },
  openGraph: {
    title: "Shia Azan — Prayer Times & Adhan",
    description: "Prayer times for Shia Muslims worldwide. Installable PWA.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b3d2e",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shia Azan",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${amiri.variable} ${reemKufi.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
          <PwaInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}

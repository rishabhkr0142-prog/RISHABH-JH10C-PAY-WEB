import { Inter, JetBrains_Mono } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FloatingThemeSwitcher } from "@/components/ThemeSwitcher";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

const SITE_NAME = "RISHABH JH10C PAY WEB";
const SITE_URL =
  process.env.SITE_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://rishabh-jh10c-pay-web.antideploy.app";
const DESCRIPTION =
  "RISHABH JH10C PAY WEB — High-performance multi-theme digital store. Instant automated delivery, Discord verification, and 24/7 dedicated support.";

export const viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Digital Store`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "digital store",
    "instant delivery",
    "RISHABH JH10C",
    "verified products",
    "discord store",
    "upi pay web",
  ],
  authors: [{ name: "RISHABH JH10C" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${SITE_NAME} — Digital Store`,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RISHABH JH10C PAY WEB",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Digital Store`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      data-theme="mono"
    >
      <head>
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){ try { var valid = ['mono','cyber','emerald','crimson','sapphire']; var t = localStorage.getItem('jh10c_theme') || 'mono'; if (valid.indexOf(t) === -1) { t = 'mono'; try { localStorage.setItem('jh10c_theme', 'mono'); } catch(e){} } document.documentElement.setAttribute('data-theme', t); } catch(e){} })();`,
          }}
        />
      </head>
      <body className="min-h-screen text-neutral-200 antialiased">
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <main className="min-h-[75vh]">{children}</main>
            <Footer />
            <FloatingThemeSwitcher />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

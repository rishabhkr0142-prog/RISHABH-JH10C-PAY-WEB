import { Inter, JetBrains_Mono } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FloatingThemeSwitcher } from "@/components/ThemeSwitcher";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

const SITE_NAME = "RISHABH JH10C PAY WEB";
const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const DESCRIPTION =
  "RISHABH JH10C PAY WEB — High-performance multi-theme digital store. Instant automated delivery, Discord verification, and 24/7 dedicated support.";

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
  ],
  authors: [{ name: "RISHABH JH10C" }],
  openGraph: {
    title: `${SITE_NAME} — Digital Store`,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Digital Store`,
    description: DESCRIPTION,
  },
  icons: { icon: "/icon.svg" },
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){ try { var t = localStorage.getItem('jh10c_theme') || 'mono'; document.documentElement.setAttribute('data-theme', t); } catch(e){} })();`,
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

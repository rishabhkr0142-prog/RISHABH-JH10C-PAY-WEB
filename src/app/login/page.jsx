"use client";

import { useEffect, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { DiscordIcon } from "@/components/Navbar";

const AUTH_ERRORS = {
  OAuthCallback: {
    title: "Discord Callback Failed",
    description:
      "Failed to complete OAuth callback with Discord. Please ensure your redirect URI matches http://localhost:3000/api/auth/callback/discord.",
  },
  OAuthSignin: {
    title: "Sign-in Initialization Failed",
    description:
      "Could not start Discord OAuth sign-in. Check your DISCORD_CLIENT_ID and network connection.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    description: "Could not create user account in the database.",
  },
  Callback: {
    title: "Callback Processing Error",
    description: "An error occurred while handling the authentication callback.",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "Access was denied or you cancelled the Discord authorization prompt.",
  },
  Configuration: {
    title: "Server Configuration Error",
    description:
      "NextAuth server configuration issue. Please check NEXTAUTH_SECRET, DISCORD_CLIENT_ID, and DISCORD_CLIENT_SECRET.",
  },
  Verification: {
    title: "Verification Failed",
    description: "The verification token has expired or has already been used.",
  },
  Default: {
    title: "Authentication Failed",
    description: "An unexpected error occurred during authentication.",
  },
};

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorCode = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const errorInfo = errorCode
    ? AUTH_ERRORS[errorCode] || {
        title: "Login Error",
        description: `Authentication failed with code: ${errorCode}`,
      }
    : null;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const loading = status === "loading" || status === "authenticated";

  const handleDiscordLogin = () => {
    signIn("discord", { callbackUrl });
  };

  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
        <div
          className="absolute left-1/2 top-1/2 h-72 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{ background: "var(--radial-glow-1)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-sm p-8 text-center shadow-2xl"
      >
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-theme-border shadow-lg"
          style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
        >
          <DiscordIcon className="h-6 w-6" />
        </span>

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
          Welcome to <span className="text-gradient">JH10C</span>
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Sign in with Discord to access your dashboard, order history, and instant fulfillment.
        </p>

        {errorInfo && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-left text-xs text-red-300">
            <p className="font-semibold">{errorInfo.title}</p>
            <p className="mt-1 text-[11px] text-red-400">{errorInfo.description}</p>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="btn-primary w-full py-3 text-xs font-bold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing In...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <DiscordIcon className="h-4 w-4" />
                Continue with Discord
              </span>
            )}
          </button>
        </div>

        <div className="mt-6 border-t border-theme-border/50 pt-4 text-[11px] text-neutral-500">
          By signing in, you agree to our Terms of Service. Authentication is securely handled by Discord OAuth2.
        </div>
      </motion.div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

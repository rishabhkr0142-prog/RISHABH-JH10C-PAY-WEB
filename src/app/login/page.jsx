"use client";

import { useEffect, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { DiscordIcon } from "@/components/Navbar";

const AUTH_ERRORS = {
  OAuthCallback: {
    title: "OAuth Callback Failed",
    description:
      "Could not complete the sign-in callback. Make sure both /api/auth/callback/google and /api/auth/callback/discord are registered for this exact domain.",
  },
  OAuthSignin: {
    title: "Sign-in Initialization Failed",
    description:
      "Could not start sign-in. Check your provider client ID, client secret, and network connection.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    description: "Could not create your user account in the database.",
  },
  OAuthAccountNotLinked: {
    title: "Email Already Registered",
    description:
      "This email is already linked to another sign-in method. Sign in with the original method, then link the new one from Profile.",
  },
  AccountAlreadyLinked: {
    title: "Account Already Linked",
    description:
      "This Google account is already linked to another store account. Sign in with the original method and link from Profile.",
  },
  DiscordAlreadyLinked: {
    title: "Discord Already Linked",
    description:
      "That Discord account is already linked to another store account.",
  },
  EmailNotVerified: {
    title: "Email Not Verified",
    description:
      "Your Google email is not verified, so it cannot be linked automatically. Verify it with Google and try again.",
  },
  Callback: {
    title: "Callback Processing Error",
    description: "An error occurred while handling the authentication callback.",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You cancelled the Google or Discord authorization prompt.",
  },
  Configuration: {
    title: "Server Configuration Error",
    description:
      "NextAuth configuration issue. Check NEXTAUTH_SECRET, DISCORD_CLIENT_ID/SECRET, and GOOGLE_CLIENT_ID/SECRET.",
  },
  Verification: {
    title: "Verification Failed",
    description: "The verification token has expired or has already been used.",
  },
  DatabaseError: {
    title: "Database Error",
    description: "Could not save your account right now. Please try again.",
  },
  Default: {
    title: "Authentication Failed",
    description: "An unexpected error occurred during authentication.",
  },
};

function GoogleIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.54 10.54 0 0 0 12 1a11 11 0 0 0-9.82 6.05l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

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

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl });
  };

  const retryLogin = () => {
    router.replace(
      `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
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
          Sign in with Google or Discord to access your dashboard, order history, and instant fulfillment.
        </p>

        {errorInfo && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-left text-xs text-red-300">
            <p className="font-semibold">{errorInfo.title}</p>
            <p className="mt-1 text-[11px] text-red-400">{errorInfo.description}</p>
            <button
              onClick={retryLogin}
              className="mt-3 rounded-md border border-red-400/30 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/10"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-4 text-sm font-bold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
                Signing In...
              </span>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </>
            )}
          </button>

          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 py-3 text-sm font-bold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing In...
              </span>
            ) : (
              <>
                <DiscordIcon className="h-4 w-4" />
                Continue with Discord
              </>
            )}
          </button>
        </div>

        <div className="mt-6 border-t border-theme-border/50 pt-4 text-[11px] text-neutral-500">
          By signing in, you agree to our Terms of Service. Authentication is securely handled by Google and Discord OAuth2.
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

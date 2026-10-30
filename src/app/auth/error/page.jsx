import Link from "next/link";

const ERROR_DETAILS = {
  Configuration: {
    title: "Configuration Error",
    message:
      "Server configuration issue. Please verify NEXTAUTH_SECRET, DISCORD_CLIENT_ID, and DISCORD_CLIENT_SECRET.",
  },
  AccessDenied: {
    title: "Access Denied",
    message:
      "You do not have permission to sign in, or you cancelled the Discord authorization request.",
  },
  Verification: {
    title: "Verification Failed",
    message:
      "The sign in verification token is invalid, expired, or has already been used.",
  },
  OAuthSignin: {
    title: "OAuth Initialization Error",
    message:
      "Failed to construct the Discord authorization URL. Please check your Discord OAuth credentials.",
  },
  OAuthCallback: {
    title: "OAuth Callback Error",
    message:
      "Error processing Discord callback. Verify that http://localhost:3000/api/auth/callback/discord is listed in your Discord Developer Portal redirect URIs.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    message: "Could not create a user record in MongoDB for your Discord account.",
  },
  Callback: {
    title: "Authentication Callback Error",
    message: "An error occurred during authentication callback processing.",
  },
  Default: {
    title: "Authentication Error",
    message: "An unexpected error occurred during authentication.",
  },
};

export default function AuthErrorPage({ searchParams }) {
  const errorKey = searchParams?.error || "Default";
  const err = ERROR_DETAILS[errorKey] || {
    title: "Authentication Error",
    message: `Authentication failed with code: ${errorKey}`,
  };

  return (
    <section className="relative flex min-h-[75vh] items-center justify-center px-4">
      <div className="glass w-full max-w-md p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-950/40 text-red-400">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-bold text-white">{err.title}</h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">{err.message}</p>

        <div className="mt-4 rounded-lg border border-theme-border bg-black/60 p-3 text-[11px] font-mono text-neutral-500">
          Error Code: {errorKey}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link href="/login" className="btn-primary flex-1 !py-2 !text-xs font-semibold">
            Try Again
          </Link>
          <Link href="/" className="btn-ghost flex-1 !py-2 !text-xs">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}

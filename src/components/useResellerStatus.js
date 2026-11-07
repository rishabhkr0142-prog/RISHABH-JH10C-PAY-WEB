"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Reseller status for client components. Starts from the JWT/session flag and
 * refreshes from the database so catalog pages never leak another user's state.
 */
export default function useResellerStatus() {
  const { data: session, status } = useSession();
  const sessionFlag = Boolean(session?.user?.isReseller);
  const [isReseller, setIsReseller] = useState(sessionFlag);

  useEffect(() => {
    setIsReseller(sessionFlag);
  }, [sessionFlag]);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsReseller(false);
      return;
    }

    let cancelled = false;

    fetch("/api/account/reseller", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.isReseller === "boolean") {
          setIsReseller(data.isReseller);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status]);

  return isReseller;
}

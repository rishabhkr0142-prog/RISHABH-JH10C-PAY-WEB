"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { timeAgo } from "@/lib/format";
import ResellerBadge from "@/components/ResellerBadge";

function Avatar({ user }) {
  const src = user.avatar || user.googlePicture || "";
  const name = user.username || user.email || "User";

  return (
    <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-theme-border bg-black">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} profile picture`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/80">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export default function ResellersManager({ resellers = [] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (!showAdd) return;

    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/resellers?scope=all&q=${encodeURIComponent(q)}&limit=20`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setSearchResults(data.users || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, showAdd]);

  const setStatus = async (user, action) => {
    setBusyId(user._id);
    setError("");
    setNotice("");

    try {
      const res = await fetch(`/api/admin/resellers/${user._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Could not update reseller.");

      setNotice(
        action === "make"
          ? `${user.username || "User"} is now a Reseller.`
          : `${user.username || "User"} is no longer a Reseller.`
      );

      if (action === "make") {
        setSearchResults((prev) =>
          prev.map((item) =>
            item._id === user._id ? { ...item, isReseller: true } : item
          )
        );
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "Could not update reseller.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = (user) => {
    setConfirmModal({
      title: `Remove reseller status from "${user.username || "User"}"?`,
      message:
        "This account will immediately lose the 50% License App discount and the Reseller badge. The membership order history is kept.",
      user,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Lifetime Resellers</h3>
          <p className="mt-1 text-[11px] text-neutral-400">
            Search any user to grant reseller status manually, or remove it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className="btn-primary !py-1.5 !text-xs font-semibold"
        >
          {showAdd ? "Close Search" : "+ Make User Reseller"}
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass overflow-hidden"
          >
            <div className="border-b border-theme-border/50 p-4">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user by name, email, Discord ID or Google sub..."
                className="input !py-2 !text-xs"
                autoFocus
              />
              <p className="mt-2 text-[11px] text-neutral-500">
                Type at least 2 characters. Only matching users are shown.
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {searching ? (
                <p className="p-4 text-xs text-neutral-400">Searching...</p>
              ) : search.trim().length < 2 ? (
                <p className="p-4 text-xs text-neutral-500">
                  Start typing to search every store user.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-xs text-neutral-500">No matching users.</p>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between gap-3 border-b border-white/5 p-3 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {user.username || "Unnamed user"}
                        </p>
                        <p className="truncate text-[10px] text-neutral-400">
                          {user.email || user.discordId || user._id}
                        </p>
                      </div>
                    </div>

                    {user.isReseller ? (
                      <div className="flex items-center gap-2">
                        <ResellerBadge />
                        <button
                          type="button"
                          onClick={() => confirmRemove(user)}
                          disabled={busyId === user._id}
                          className="rounded border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus(user, "make")}
                        disabled={busyId === user._id}
                        className="btn-primary !px-3 !py-1.5 !text-[11px] font-semibold"
                      >
                        {busyId === user._id ? "Saving..." : "Make Reseller"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {resellers.length === 0 ? (
        <div className="glass p-12 text-center text-xs text-neutral-500">
          No resellers yet. Use “Make User Reseller” to grant the first membership.
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-4 font-medium">Reseller</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Order No</th>
                  <th className="p-4 font-medium">Spent</th>
                  <th className="p-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resellers.map((user) => (
                  <tr key={user._id} className="transition hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={user} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-semibold text-white">
                            {user.username || "Unnamed user"}
                            <ResellerBadge />
                          </p>
                          <p className="truncate text-[10px] text-neutral-400">
                            {user.email || user.discordId || user._id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-neutral-400">
                      {user.resellerSince ? timeAgo(user.resellerSince) : "—"}
                    </td>
                    <td className="p-4 font-mono text-neutral-300">
                      {user.resellerOrderNo || "—"}
                    </td>
                    <td className="p-4 font-mono text-neutral-300">
                      {Number(user.totalSpent) > 0
                        ? `₹${Number(user.totalSpent).toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => confirmRemove(user)}
                        disabled={busyId === user._id}
                        className="rounded border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="glass w-full max-w-md p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white">
                {confirmModal.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {confirmModal.message}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const user = confirmModal.user;
                    setConfirmModal(null);
                    setStatus(user, "remove");
                  }}
                  className="btn-primary !py-2 !text-xs font-bold"
                >
                  Confirm Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

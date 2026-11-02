import connectDB from "@/lib/db";
import User from "@/models/User";
import { linkedDiscordId, linkedGoogleSub } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users Directory | Admin" };

export default async function AdminUsersPage() {
  await connectDB();
  const users = toPlainText(await User.find().sort({ createdAt: -1 }).lean());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Registered Users Directory</h2>
        <p className="mt-1 text-xs text-neutral-400">
          {users.length} member{users.length === 1 ? "" : "s"} authenticated through Google or Discord.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="glass p-12 text-center text-xs text-neutral-500">
          No users recorded yet. Users appear automatically upon signing in with Google or Discord.
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Linked Accounts</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => {
                  const discordId = linkedDiscordId(user);
                  const googleSub = linkedGoogleSub(user);
                  const googleEmail = user.authProviders?.google?.email || "";

                  return (
                  <tr key={user._id} className="transition hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full border border-theme-border bg-black">
                          {user.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-mono text-[10px] font-bold text-white">
                              {(user.username || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-white">{user.username}</span>
                      </div>
                    </td>
                    <td
                      className="space-y-1 p-4 font-mono font-medium"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      {discordId && <div>Discord: {discordId}</div>}
                      {googleSub && (
                        <div>Google: {googleEmail || "Linked"}</div>
                      )}
                      {!discordId && !googleSub && <div>None</div>}
                    </td>
                    <td className="p-4 text-neutral-400">{user.email || "Not provided"}</td>
                    <td className="p-4">
                      <span className="badge-theme px-2 py-0.5 text-[10px] font-medium uppercase">
                        {user.role || "user"}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-500">
                      {timeAgo(user.createdAt)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

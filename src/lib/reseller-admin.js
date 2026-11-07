import connectDB from "@/lib/db";
import User from "@/models/User";
import { escapeRegex } from "@/lib/account";

const USER_FIELDS = [
  "discordId",
  "username",
  "avatar",
  "googlePicture",
  "email",
  "role",
  "isReseller",
  "resellerSince",
  "resellerOrderNo",
  "createdAt",
  "lastOrderAt",
  "orderCount",
  "totalSpent",
].join(" ");

function searchFilter(query) {
  const clean = String(query || "").trim();
  if (!clean) return {};
  const rx = new RegExp(escapeRegex(clean), "i");
  return {
    $or: [
      { username: rx },
      { email: rx },
      { discordId: rx },
      { "authProviders.discord.id": rx },
      { "authProviders.google.email": rx },
      { "authProviders.google.sub": rx },
    ],
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function listResellers({ q = "", page = 1, limit = 50 } = {}) {
  await connectDB();

  const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
  const requestedPage = Number(page);
  const requested =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.floor(requestedPage)
      : 1;

  const filter = { isReseller: true, ...searchFilter(q) };
  const total = await User.countDocuments(filter).catch(() => 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(requested, totalPages);

  const users = await User.find(filter)
    .select(USER_FIELDS)
    .sort({ resellerSince: -1, createdAt: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .lean();

  return {
    users: plain(users),
    total,
    page: safePage,
    totalPages,
  };
}

export async function searchUsers({ q = "", limit = 20 } = {}) {
  await connectDB();

  const clean = String(q || "").trim();
  if (!clean) return [];

  const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)));
  const users = await User.find(searchFilter(clean))
    .select(USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return plain(users);
}

export async function setResellerStatus(userId, makeReseller) {
  await connectDB();

  const id = String(userId || "");
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return { ok: false, error: "Invalid user id.", status: 400 };
  }

  if (makeReseller) {
    const user = await User.findById(id);
    if (!user) return { ok: false, error: "User not found.", status: 404 };

    if (!user.isReseller) {
      user.isReseller = true;
      user.resellerSince = new Date();
      user.resellerOrderNo = "ADMIN";
      await user.save();
    }

    return { ok: true, user: plain(user.toObject ? user.toObject() : user) };
  }

  const updated = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        isReseller: false,
        resellerSince: null,
        resellerOrderNo: "",
      },
    },
    { new: true }
  )
    .select(USER_FIELDS)
    .lean();

  if (!updated) return { ok: false, error: "User not found.", status: 404 };

  return { ok: true, user: plain(updated) };
}

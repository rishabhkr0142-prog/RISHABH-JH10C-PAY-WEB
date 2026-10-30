import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

export const revalidate = 60; // 60s cache revalidation

/**
 * GET /api/community
 * Public endpoint returning total member count and latest Discord avatars/usernames
 * strictly omitting private fields (email, discordId, role).
 */
export async function GET() {
  try {
    await connectDB();

    const [total, avatarUsers, fallbackUsers] = await Promise.all([
      User.countDocuments().catch(() => 0),
      User.find({ avatar: { $exists: true, $nin: ["", null] } })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("username avatar -_id")
        .lean()
        .catch(() => []),
      User.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .select("username avatar -_id")
        .lean()
        .catch(() => []),
    ]);

    // Use users with avatars first, filling in from latest if needed
    const userPool = avatarUsers.length >= 6 ? avatarUsers : fallbackUsers;
    const latestAvatars = userPool.slice(0, 12).map((u) => ({
      username: u.username || "Member",
      avatar: u.avatar || "",
    }));

    return NextResponse.json({
      total: Math.max(total, latestAvatars.length),
      latestAvatars,
    });
  } catch (err) {
    console.error("GET /api/community failed:", err);
    return NextResponse.json({
      total: 0,
      latestAvatars: [],
    });
  }
}


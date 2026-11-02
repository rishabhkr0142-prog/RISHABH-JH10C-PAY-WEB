import connectDB from "@/lib/db";
import { getPublicStats } from "@/lib/stats";
import { getAllSettings } from "@/lib/settings";
import { getLiveOffers } from "@/lib/offers";
import { getGoogleUsersStats } from "@/lib/google-users";
import User from "@/models/User";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import OffersSection from "@/components/OffersSection";
import CommunitySection from "@/components/CommunitySection";
import GoogleUsersSection from "@/components/GoogleUsersSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import HowItWorks from "@/components/HowItWorks";
import FaqAccordion from "@/components/FaqAccordion";
import FinalCta from "@/components/FinalCta";

// Cache the public landing page for 60s; writes call revalidatePath("/").
export const revalidate = 60;

export default async function HomePage() {
  let stats = { users: 0, orders: 0, clients: 0 };
  let communityData = { total: 0, latestAvatars: [] };
  let googleUsers = { total: 0, avatars: [] };
  let settings = {};
  let offers = [];

  try {
    await connectDB();
    const [
      fetchedStats,
      totalUsers,
      avatarUsers,
      fetchedSettings,
      fetchedOffers,
      fetchedGoogleUsers,
    ] = await Promise.all([
      getPublicStats().catch(() => ({ users: 0, orders: 0, clients: 0 })),
      User.countDocuments().catch(() => 0),
      User.find({ avatar: { $exists: true, $nin: ["", null] } })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("username avatar -_id")
        .lean()
        .catch(() => []),
      getAllSettings().catch(() => ({})),
      getLiveOffers().catch(() => []),
      getGoogleUsersStats().catch(() => ({ total: 0, avatars: [] })),
    ]);

    stats = fetchedStats;
    settings = fetchedSettings || {};
    offers = fetchedOffers || [];
    googleUsers = fetchedGoogleUsers || { total: 0, avatars: [] };

    let userList = avatarUsers;
    if (userList.length < 6) {
      const fallbackUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .select("username avatar -_id")
        .lean()
        .catch(() => []);
      userList = fallbackUsers;
    }

    communityData = {
      total: Math.max(totalUsers, userList.length),
      latestAvatars: userList.map((u) => ({
        username: u.username || "Member",
        avatar: u.avatar || "",
      })),
    };
  } catch (err) {
    console.error("Failed to load home page data:", err?.message || err);
  }

  const discordUrl =
    settings.discord_invite ||
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ||
    "#";

  return (
    <div className="relative">
      {/* 1. Hero */}
      <Hero discordUrl={discordUrl} />

      {/* 2. Live Stats Strip right under hero */}
      <StatsSection stats={stats} />

      {/* 3. Time-limited offers (auto-hides when expired) */}
      <OffersSection offers={offers} />

      {/* 4. Community section with overlapping Discord avatars */}
      <CommunitySection communityData={communityData} />

      {/* 5. Google sign-in users (privacy-safe photos + count) */}
      <GoogleUsersSection googleUsers={googleUsers} />

      {/* 6. Features grid (6 monochrome cards) */}
      <FeaturesGrid />

      {/* 7. How it works (3 steps with line) */}
      <HowItWorks />

      {/* 8. FAQ Accordion (5 items) */}
      <FaqAccordion />

      {/* 9. Final CTA */}
      <FinalCta discordUrl={discordUrl} />
    </div>
  );
}

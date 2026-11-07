/**
 * Manual Database Seeding Script
 * 
 * Usage:
 *   npm run seed
 *   or
 *   node scripts/seed.js
 * 
 * Note: This script will NEVER overwrite or re-seed if products already exist in the database.
 * It is completely decoupled from the web application and never called automatically.
 */

const mongoose = require("mongoose");
const { resolveDbName } = require("./lib/db");
const fs = require("fs");
const path = require("path");

// 1. Load environment variables from .env or .env.local
function loadEnvironment() {
  const rootDir = path.resolve(__dirname, "..");
  const candidateFiles = [".env.local", ".env"];

  for (const fileName of candidateFiles) {
    const fullPath = path.join(rootDir, fileName);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}

loadEnvironment();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI is not defined in .env or .env.local");
  process.exit(1);
}

// 2. Define Product Schema
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    productKey: { type: String, default: "", trim: true, lowercase: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0, default: 0 },
    plans: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          days: { type: Number, default: 0, min: 0 },
          price: { type: Number, required: true, min: 0, default: 0 },
          stock: { type: Number, default: 10, min: 0 },
        },
      ],
      default: [],
    },
    category: { type: String, default: "General", trim: true },
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },
    features: { type: [String], default: [] },
    stock: { type: Number, default: 10, min: 0 },
    active: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "products" }
);

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

// 3. Sample Demo Data
const SAMPLE_PRODUCTS = [
  {
    name: "Discord Nitro 1 Year (Gift Link)",
    slug: "discord-nitro-1-year",
    description: "Get full Discord Nitro subscription for 12 months with 2 server boosts, HD streaming, custom emojis anywhere, and a 500MB upload limit. Delivered instantly as an official gift link.",
    price: 1999,
    plans: [
      { label: "1 Month", days: 30, price: 199, stock: 50 },
      { label: "3 Months", days: 90, price: 549, stock: 35 },
      { label: "1 Year", days: 365, price: 1999, stock: 25 },
      { label: "Lifetime", days: 0, price: 4499, stock: 10 },
    ],
    category: "Subscriptions",
    images: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    features: [
      "12 Months Full Nitro Access",
      "2 Free Server Boosts included",
      "500MB Upload limit & 4K 60FPS Streaming",
      "Works on any Discord account (No ban risk)",
      "Instant automated delivery",
    ],
    stock: 25,
    active: true,
    available: true,
  },
  {
    name: "Netflix Premium 4K UHD (Private Profile)",
    slug: "netflix-premium-4k-uhd",
    description: "Personal private profile with PIN protection on a legitimate 4K Ultra HD Netflix account. Enjoy Dolby Atmos, HDR, and unlimited streaming without household restrictions.",
    price: 349,
    category: "Subscriptions",
    images: [
      "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&auto=format&fit=crop&q=80",
    features: [
      "4K Ultra HD + HDR Support",
      "Personal PIN Locked Profile",
      "30 Days Full Replacement Warranty",
      "Works on TV, PC, Mobile & Console",
      "No VPN required",
    ],
    stock: 18,
    active: true,
    available: true,
  },
  {
    name: "Spotify Premium 12 Months (Upgrade)",
    slug: "spotify-premium-12-months",
    description: "Upgrade your own existing Spotify account to Premium Individual for a full year. No ads, unlimited skips, offline downloads, and high-fidelity 320kbps audio playback.",
    price: 599,
    category: "Subscriptions",
    images: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    features: [
      "Applied directly to your own account",
      "Ad-free music listening & podcasting",
      "High quality audio (320 kbps)",
      "Download music for offline play",
      "1-Year replacement guarantee",
    ],
    stock: 40,
    active: true,
    available: true,
  },
  {
    name: "GTA V Online Modded Account (PC)",
    slug: "gta-v-online-modded-account-pc",
    description: "Ready-to-play GTA V Online PC Rockstar / Social Club account loaded with $500,000,000 cash, rank 150+, all unlocks, fast run, and premium modded outfits.",
    price: 1499,
    category: "Gaming",
    images: [
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    features: [
      "$500M+ Banked Cash",
      "Level 150+ Rank",
      "All Heist Vehicles & Hangars Unlocked",
      "Full Email & Password Changeable",
      "Anti-Ban Verified & Clean History",
    ],
    stock: 12,
    active: true,
    available: true,
  },
  {
    name: "ChatGPT Plus & Claude Pro Shared Suite",
    slug: "chatgpt-plus-claude-pro-suite",
    description: "Access both OpenAI GPT-4o Plus and Anthropic Claude 3.5 Sonnet Pro for 30 days. Perfect for coding, writing, research, and high-speed reasoning without paying $40/mo.",
    price: 799,
    category: "Software",
    images: [
      "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
    features: [
      "GPT-4o & DALL-E 3 image generator",
      "Claude 3.5 Sonnet Artifacts & Code editing",
      "30 Days continuous uptime",
      "Web browsing & document analysis",
      "Fast response priority servers",
    ],
    stock: 15,
    active: true,
    available: true,
  },
  {
    name: "YouTube Premium 6 Months (Invite Link)",
    slug: "youtube-premium-6-months",
    description: "Ad-free YouTube & YouTube Music streaming on all your devices. Background play, Picture-in-Picture, and 1080p Premium enhanced bitrate.",
    price: 399,
    category: "Subscriptions",
    images: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80",
    ],
    imageUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80",
    features: [
      "Ad-free YouTube videos worldwide",
      "Includes YouTube Music Premium",
      "Background video play on mobile",
      "High Bitrate 1080p stream quality",
      "Instant invitation to your Gmail",
    ],
    stock: 30,
    active: true,
    available: true,
  },
];

async function runSeed() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
    dbName: resolveDbName(MONGODB_URI),
  });

  console.log("🔍 Checking existing products in MongoDB...");
  const count = await Product.countDocuments();

  if (count > 0) {
    console.log(`ℹ️ Database already has ${count} product(s).`);
    console.log("🛡️ Skipping seed to prevent overwriting or re-inserting deleted products.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("📦 No products found. Seeding 6 default sample products...");
  await Product.insertMany(SAMPLE_PRODUCTS);
  console.log("✅ Successfully seeded sample products into MongoDB.");

  await mongoose.disconnect();
  console.log("👋 Disconnected from MongoDB.");
  process.exit(0);
}

runSeed().catch(async (err) => {
  console.error("❌ Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(1);
});


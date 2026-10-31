# ⚡ RISHABH JH10C PAY WEB

A **premium dark-theme digital product store** built with Next.js (App Router),
Tailwind CSS, Framer Motion, MongoDB (Mongoose) and Discord OAuth2 (NextAuth.js).

> 🛒 Featured: animated hero, live count-up stats from MongoDB, product grid,
> "Why Choose Us", custom 404, loading skeletons, protected dashboard, and a
> full owner-only admin panel.
>
> 💳 **Payments are not wired yet.** The checkout page ("Buy Now") is a clean
> stub — see [Payment Integration](#-payment-integration-later) below for where
> to plug your provider in.

---

## ✨ Features

| Area | Details |
|---|---|
| Home | Animated hero, **Live Stats** (Total Clients / Users / Orders — animated count-up, from MongoDB), product grid with **Buy Now**, Why Choose Us |
| Navbar | Sticky glass navbar, links **Home \| Login \| Support** (Login right next to Home), Discord avatar + dropdown (Dashboard / Logout) after login |
| Login | Big "Login with Discord" button; first login saves the user to MongoDB and bumps **Total Users** |
| Dashboard | Protected (`/dashboard`) — redirect to `/login` if not logged in; profile + order history |
| Support | `NEXT_PUBLIC_SUPPORT_EMAIL`, "Join Support Server" button (`NEXT_PUBLIC_DISCORD_INVITE_URL`), FAQ |
| Admin (`/admin`) | Owner-only (via `ADMIN_DISCORD_ID`): add/edit/delete **products**, view **users**, add/delete **clients**, record/manage **orders**, manually update **stats** |
| Extras | SEO meta tags, favicon (SVG), custom 404, shimmer loading skeletons, smooth page transitions & scroll animations, fully responsive |

---

## 🚀 Quick Start (local)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local      # then edit .env.local (see steps below)

# 3. Run the dev server
npm run dev
# open http://localhost:3000
```

You need **all** env vars below before `npm run dev` will work.

---

## 🔑 Step-by-step setup

### 1) MongoDB Atlas (free tier is enough)

1. Create an account at [cloud.mongodb.com](https://cloud.mongodb.com) → **Build a Cluster** → choose **M0 Free**.
2. **Create a database user**: Database Access → Add New Database User → user + password (save them!).
3. **Allow network access**: Network Access → Add IP Address → `0.0.0.0/0` (allow from anywhere — required for Vercel serverless).
4. **Get your connection string**: Clusters → **Connect** → **Drivers** → copy the `mongodb+srv://...` string.
5. Replace `<username>` and `<password>` in it, and set it in `.env.local`:

   ```env
   MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/jh10c-store?retryWrites=true&w=majority
   ```

   (`jh10c-store` is the database name — it will be created automatically.)

### 2) Discord OAuth2 app

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → give it a name (e.g. *"RISHABH JH10C STORE"*) → Create.
2. Open your new app → **OAuth2** in the sidebar:
   - Copy the **Client ID** → this is `DISCORD_CLIENT_ID`
   - Click **Reset Secret**, copy it → `DISCORD_CLIENT_SECRET`
3. In **OAuth2 → Redirects**, add BOTH of these:

   ```
   http://localhost:3000/api/auth/callback/discord
   https://YOUR-DOMAIN.vercel.app/api/auth/callback/discord
   ```

   (replace `YOUR-DOMAIN.vercel.app` with your real Vercel URL — add it after your first deploy too; Vercel preview URLs can be added the same way)
4. **Get your own Discord ID** (used for admin access):
   - In the Discord app: Settings → Advanced → enable **Developer Mode**
   - Right-click your own name (or your avatar) → **Copy User ID** → this is `ADMIN_DISCORD_ID`

### 3) Finish `.env.local`

```env
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/jh10c-store?retryWrites=true&w=majority

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

ADMIN_DISCORD_ID=your_discord_user_id

# Optional / public:
NEXT_PUBLIC_SUPPORT_EMAIL=[YOUR EMAIL HERE]
NEXT_PUBLIC_DISCORD_INVITE_URL=https://discord.gg/your-invite
NEXT_PUBLIC_CURRENCY=₹
```

> On Windows you can generate the secret in Node: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

---

## 🧭 Using the site

1. Start the dev server → **Login** in the navbar → your first login creates your user in MongoDB.
2. Become the owner: make sure you log in with the SAME Discord account as `ADMIN_DISCORD_ID` → the navbar **still shows Home/Login/Support** — just type `/admin` in the URL (the button is intentionally not public).
3. In **/admin → Products**: add your first product (name, price, optional image URL). It appears on the home page instantly.
4. Orders made outside the site (Discord DMs, UPI) → **/admin → Orders → Record Order**.
5. The stats on the home page update automatically (new user / new order / new client) and can be corrected anytime in **/admin → Stats**.

---

## ▲ Deploy to Vercel

1. Push this project to GitHub (the repo already has `.gitignore`).
2. [vercel.com/new](https://vercel.com/new) → **Import** the repo.
3. Framework preset: **Next.js** (auto-detected). Deploy once so a URL exists.
4. Go to **Project → Settings → Environment Variables** and add **every variable** from your `.env.local`:
   `MONGODB_URI`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ADMIN_DISCORD_ID`, plus any `NEXT_PUBLIC_*` ones you use.
   - Set `NEXTAUTH_URL` to your production URL, e.g. `https://jh10c.vercel.app`
5. **Redeploy** (Deployments → latest → Redeploy) so the env vars take effect.
6. Back in Discord Developer Portal → OAuth2 → Redirects → add
   `https://YOUR-DOMAIN.vercel.app/api/auth/callback/discord`.
7. Done — the live site is ready. *(Note: on Vercel Hobby plan, cron/scheduled jobs are not used by this project — nothing extra to configure.)*

---

## 💳 UPI Instant Checkout & Payment Gateway

The platform features an automated server-side UPI QR Code payment gateway with a 10-minute expiry window:

- **Server-Generated QR Code:** When a logged-in user clicks "Buy Now" on any product/plan, an order is generated with status `pending` and `expiresAt = now + 10 minutes`.
- **UPI Deep Link:** Auto-generates `upi://pay?pa=UPI_ID&pn=UPI_NAME&am=AMOUNT&cu=INR&tn=ORDER_ID` rendered on the server via `qrcode` (no third-party gateway fee, 0% commission).
- **Mobile One-Tap Pay:** Includes "Pay with UPI app" button opening GPay, PhonePe, Paytm, or BHIM directly on mobile devices.
- **10-Minute Countdown Timer:** Live timer (`mm:ss`) with a dynamic progress bar turning red when under 60 seconds. Automatically deactivates the QR code and marks the order as `expired` at 00:00.
- **UTR / Transaction Reference:** Users can submit their 12-digit UPI UTR number for manual/automated verification.
- **Admin Verification:** Admin orders tab displays UTR, live expiry countdown, and one-click actions: **Mark Paid**, **Mark Completed**, **Cancel**.
- **Real-time Polling:** The checkout page polls order status every 5 seconds, instantly transitioning to the green verified success screen when the admin confirms payment.

### Environment Configuration:
```env
# Server-only UPI configuration (never exposed in client code)
UPI_ID=your_upi_id@okaxis
UPI_NAME="RISHABH JH10C PAY"
```

---

## 🗂 Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── admin/…          # owner-only routes (products/clients/orders/stats)
│   │   └── auth/[...nextauth]/
│   ├── admin/               # owner-only panel (layout guards every page)
│   ├── checkout/            # Buy Now → checkout stub (payment placeholder)
│   ├── dashboard/           # protected user dashboard
│   ├── login/               # "Login with Discord"
│   ├── support/             # email + Discord button + FAQ
│   ├── layout.jsx           # root layout: fonts, SEO metadata, navbar+footer
│   ├── page.jsx             # home (hero / stats / products / why-us)
│   ├── template.jsx         # page transition animation
│   ├── loading.jsx          # shimmer skeletons
│   ├── not-found.jsx        # custom 404
│   ├── icon.svg             # favicon
│   └── globals.css          # theme, glass utilities, animations
├── components/              # Navbar, Hero, StatsSection, ProductCard, …
├── lib/                     # db.js, auth.js, stats.js, session.js, format.js
└── models/                  # User, Product, Order, Client, Stat (Mongoose)
```

## 🔐 Security notes

- `/admin` pages **and** all `/api/admin/*` routes check the NextAuth session
  and compare the Discord ID against `ADMIN_DISCORD_ID` server-side.
- Dashboard pages redirect anonymous visitors to `/login` server-side.
- Never commit `.env.local` — it's already in `.gitignore`.
- Discord `NEXT_PUBLIC_*` vars are safe to expose; never prefix server secrets
  with `NEXT_PUBLIC_`.

---

Built with 🖤 — RISHABH JH10C

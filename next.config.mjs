/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow remote avatars / product images.
  // Product images can be hosted anywhere (ImgBB, Imgur, CDN, Unsplash, ...),
  // so we whitelist the well-known ones Discord users need.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "i.ibb.co" },
    ],
  },
};

export default nextConfig;

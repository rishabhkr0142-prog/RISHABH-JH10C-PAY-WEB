import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Support & Help Center",
  description:
    "Get help with orders, UPI payments, delivery, and replacements via WhatsApp, Discord, or email. Read common questions first.",
  path: "/support",
});

export default function SupportLayout({ children }) {
  return children;
}

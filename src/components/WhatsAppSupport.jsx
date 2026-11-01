const RAW_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

/** Digits-only WhatsApp number (country code + number, no +/spaces). */
export const WHATSAPP_NUMBER = RAW_NUMBER.replace(/[^\d]/g, "");

export function buildWhatsAppLink(message = "") {
  if (!WHATSAPP_NUMBER) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${WHATSAPP_NUMBER}${text}`;
}

export function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.21-8.23 8.21Z" />
    </svg>
  );
}

/**
 * Green WhatsApp support button.
 * Renders nothing when NEXT_PUBLIC_WHATSAPP_NUMBER is not configured.
 */
export default function WhatsAppSupport({
  message = "",
  label = "WhatsApp Support",
  className = "",
}) {
  if (!WHATSAPP_NUMBER) return null;

  return (
    <a
      href={buildWhatsAppLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-[#062d16] transition hover:bg-[#1ebe5b] active:scale-[0.98] ${className}`}
    >
      <WhatsAppIcon className="h-4 w-4" />
      {label}
    </a>
  );
}

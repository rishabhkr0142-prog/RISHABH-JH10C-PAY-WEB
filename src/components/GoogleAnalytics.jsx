import Script from "next/script";

export default function GoogleAnalytics() {
  const gaId = String(process.env.NEXT_PUBLIC_GA_ID || "").trim();

  if (!/^G-[A-Z0-9]{6,20}$/i.test(gaId)) return null;

  const initScript = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', ${JSON.stringify(
    gaId
  )}, { anonymize_ip: true });`;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          gaId
        )}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initScript }}
      />
    </>
  );
}

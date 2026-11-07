import QRCode from "qrcode";

/**
 * Generate a high-resolution, clean, sharp UPI QR code.
 *
 * Uses Error Correction Level 'M' (~15% error tolerance) without center logo overlay,
 * ensuring 100% unimpeded scanning speed and decoding reliability across all UPI apps
 * (PhonePe, Google Pay, Paytm, BHIM, Cred, and mobile banking apps).
 *
 * Features:
 * - Pure white background (#ffffff) with black modules (#000000)
 * - Standard 4-module quiet zone (margin) to guarantee edge detection
 * - Clean data URL output (image/png) for both sharp on-screen rendering and Save QR downloads
 */
export async function generateQrCode(text, { size = 600 } = {}) {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 4,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Failed to generate QR code:", err?.message || err);
    try {
      // Conservative fallback
      return await QRCode.toDataURL(text, {
        width: 360,
        margin: 4,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (fallbackErr) {
      console.error("QR fallback failed completely:", fallbackErr?.message || fallbackErr);
      return "";
    }
  }
}

// Backward compatibility alias
export const generateBrandedQrCode = generateQrCode;

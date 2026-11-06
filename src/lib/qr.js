import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import sharp from "sharp";

/**
 * Generate a high-resolution, sharp QR code with a clean logo overlay in the center.
 *
 * Uses Error Correction Level 'Q' (~25% error tolerance) so standard UPI scanner apps
 * (GPay, PhonePe, Paytm, BHIM, Cred, Banking apps) reliably decode the matrix.
 * Center logo size is constrained to <= 16% of total dimensions to preserve quiet zone
 * and scan fidelity.
 */
export async function generateBrandedQrCode(text, { size = 600 } = {}) {
  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      width: size,
      margin: 4,
      errorCorrectionLevel: "Q",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    const logoPath = path.join(process.cwd(), "public", "logo-icon.png");

    if (!fs.existsSync(logoPath)) {
      return `data:image/png;base64,${qrBuffer.toString("base64")}`;
    }

    // 16% of total dimension (e.g. 96px for 600px QR)
    const logoSize = Math.round(size * 0.16);
    const badgePadding = Math.max(8, Math.round(logoSize * 0.12));
    const badgeSize = logoSize + badgePadding * 2;
    const cornerRadius = Math.round(badgeSize * 0.18);

    const bgBadgeSvg = Buffer.from(
      `<svg width="${badgeSize}" height="${badgeSize}"><rect width="${badgeSize}" height="${badgeSize}" rx="${cornerRadius}" fill="#ffffff"/></svg>`
    );

    const resizedLogo = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: "contain" })
      .toBuffer();

    const badgedLogo = await sharp(bgBadgeSvg)
      .composite([{ input: resizedLogo, gravity: "center" }])
      .png()
      .toBuffer();

    const finalBuffer = await sharp(qrBuffer)
      .composite([{ input: badgedLogo, gravity: "center" }])
      .png()
      .toBuffer();

    return `data:image/png;base64,${finalBuffer.toString("base64")}`;
  } catch (err) {
    console.error("Failed to generate branded QR code, falling back:", err?.message || err);
    try {
      return await QRCode.toDataURL(text, {
        width: 360,
        margin: 3,
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


import crypto from "crypto";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }

  return { cloudName, apiKey, apiSecret };
}

function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

/**
 * Upload an image buffer to Cloudinary using the signed upload API.
 * Returns the Cloudinary response (secure_url, public_id, width, height, ...).
 */
export async function uploadImage(buffer, { folder = "products" } = {}) {
  const { cloudName, apiKey, apiSecret } = getConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams = { folder, timestamp };
  const signature = signParams(signedParams, apiSecret);

  const formData = new FormData();
  formData.append("file", new Blob([buffer]), "upload");
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("signature", signature);

  const res = await fetch(`${CLOUDINARY_UPLOAD_URL}/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error?.message || `Cloudinary upload failed (HTTP ${res.status}).`);
  }

  return data;
}

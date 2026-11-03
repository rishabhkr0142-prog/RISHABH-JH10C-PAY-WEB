import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { uploadImage } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const DEFAULT_FOLDER = "rishabh-jh10c/products";
const ALLOWED_FOLDERS = new Set([DEFAULT_FOLDER, "rishabh-jh10c/offers"]);

/**
 * Detect the image type from its signature so the server does not trust the
 * browser-provided MIME type alone.
 */
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return "";

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }

  const header = buffer.subarray(0, 12).toString("ascii");
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp";
  }

  if (header.slice(4, 8) === "ftyp") {
    const brand = header.slice(8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return "";
}

/**
 * POST /api/admin/upload — upload a product/offer image to Cloudinary.
 * Body: multipart form-data with "file" and optional "folder".
 * Returns { ok, url, publicId, width, height }.
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WEBP, GIF or AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 5 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const detectedType = detectImageType(buffer);
    if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
      return NextResponse.json(
        { error: "The file does not look like a valid JPG, PNG, WEBP, GIF or AVIF image." },
        { status: 400 }
      );
    }

    const requestedFolder = String(formData.get("folder") || "").trim();
    const folder = ALLOWED_FOLDERS.has(requestedFolder)
      ? requestedFolder
      : DEFAULT_FOLDER;

    const result = await uploadImage(buffer, { folder });

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error("POST /api/admin/upload:", err);
    return NextResponse.json(
      { error: err.message || "Could not upload image. Please try again." },
      { status: 500 }
    );
  }
}

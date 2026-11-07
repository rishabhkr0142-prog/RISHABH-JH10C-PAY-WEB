"use client";

import { useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function validateFile(file) {
  if (!file) return "Please choose an image file.";
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Use JPG, PNG or WEBP.";
  }
  if (file.size > MAX_BYTES) {
    return "Image is too large. Maximum size is 2 MB.";
  }
  return "";
}

/**
 * Shared image field used by the product and offer admin forms.
 * Supports file upload (click or drag & drop) with progress, an optional
 * manual https URL, preview, and remove.
 *
 * onChange(url, publicId) is called whenever the image changes. publicId is
 * the Cloudinary id for uploaded files and "" for manually pasted URLs.
 */
export default function ImageUploadField({
  value = "",
  onChange,
  folder = "rishabh-jh10c/products",
  alt = "",
  fallbackText = "",
  disabled = false,
  helpText = "Uploaded to Cloudinary and saved as a permanent https URL.",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const openPicker = () => {
    if (uploading || disabled) return;
    inputRef.current?.click();
  };

  const uploadFile = (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);

    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        onChange(data.url, data.publicId || "");
        setProgress(100);
      } else {
        setError(data.error || "Image upload failed. Please try again.");
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      setError("Image upload failed. Check your connection and try again.");
      setUploading(false);
    };

    xhr.send(body);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading || disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleRemove = () => {
    setError("");
    setProgress(0);
    onChange("", "");
  };

  const handleUrlChange = (event) => {
    setError("");
    onChange(event.target.value, "");
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading && !disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex flex-col gap-3 rounded-xl border bg-black/40 p-3 transition sm:flex-row sm:items-center ${
          dragActive
            ? "border-white/60 bg-white/10"
            : "border-white/10"
        }`}
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black sm:w-40">
          <ProductImage
            src={value}
            alt={alt || "Image preview"}
            width={320}
            sizes="160px"
            fallbackText={fallbackText || alt}
          />

          {value && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute right-1.5 top-1.5 rounded-md border border-white/20 bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md transition hover:border-red-400/60 hover:bg-red-950/80 hover:text-red-300"
              title="Remove image"
            >
              Remove
            </button>
          )}
        </div>

        <div className="w-full space-y-2">
          <div
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicker();
              }
            }}
            className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-semibold text-white transition ${
              dragActive
                ? "border-white/60 bg-white/10"
                : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
            } ${uploading || disabled ? "cursor-wait opacity-70" : ""}`}
          >
            {uploading
              ? `Uploading... ${progress}%`
              : dragActive
              ? "Drop image to upload"
              : value
              ? "Replace image (max 2 MB)"
              : "Upload image or drag & drop (max 2 MB)"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileChange}
              disabled={uploading || disabled}
              className="hidden"
            />
          </div>

          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-150"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-neutral-500">{helpText}</p>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      </div>

      <input
        type="url"
        value={value}
        onChange={handleUrlChange}
        placeholder="https://res.cloudinary.com/..."
        className="input mt-3"
      />
      <p className="mt-1 text-[11px] text-neutral-500">
        Or paste a direct https:// image link. Only Cloudinary image URLs render on the
        storefront.
      </p>
    </div>
  );
}

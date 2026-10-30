/**
 * Serialization helpers for passing MongoDB documents from
 * Server Components to client components / across the RSC boundary.
 */

/** Convert a doc (or an array of docs) with ObjectIds/Dates into plain JSON. */
export function toPlainText(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Get a plain-string id from any doc-like object. */
export function docId(doc) {
  return doc?._id ? String(doc._id) : "";
}

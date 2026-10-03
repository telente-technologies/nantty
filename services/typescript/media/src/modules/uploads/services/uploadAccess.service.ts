import { notFound } from "../../../errors/media.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { uploadSessionRepository } from "../repositories/uploadSession.repository.js";

export async function requireOwnedUploadSession(context: HandlerContext, ownerId: string, lookup: { readonly uploadId: string } | { readonly mediaId: string }) {
  const db = context.database.client;
  const session = "uploadId" in lookup ? await uploadSessionRepository.findById(db, lookup.uploadId) : await uploadSessionRepository.findByMediaId(db, lookup.mediaId);
  if (session === null || session.ownerId !== ownerId) throw notFound("UPLOAD_NOT_FOUND", "Upload session not found");
  return session;
}

export function requireOpenUploadSession(session: { readonly status: string; readonly expiresAt: Date }, now: Date) {
  if (session.status !== "uploading" || session.expiresAt <= now) throw notFound("UPLOAD_NOT_FOUND", "Upload session not found");
}

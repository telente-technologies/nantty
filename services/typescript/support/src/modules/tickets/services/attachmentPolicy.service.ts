import { maximumAttachmentsPerMessage } from "../../../constants/support.constant.js";
import { SupportError, badRequest } from "../../../errors/support.error.js";
import type { MediaDirectory } from "../../../interfaces/mediaDirectory.interface.js";
import type { TicketAttachment } from "../../../types/ticket.type.js";

const contentTypeByExtension: Readonly<Record<string, string>> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", pdf: "application/pdf" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unusableStatuses = new Set(["uploading", "rejected", "deleted", "failed"]);
const notUploadedThroughNantty = () => badRequest("INVALID_ATTACHMENT", "Attachments must be uploaded through Nantty first.");

export interface ParsedAttachment extends TicketAttachment {
  readonly mediaId: string | null;
}

export function validateAttachmentUrls(urls: readonly string[], allowedBaseUrls: readonly string[]): ParsedAttachment[] {
  if (urls.length > maximumAttachmentsPerMessage) throw badRequest("TOO_MANY_ATTACHMENTS", `Attach up to ${maximumAttachmentsPerMessage} files.`);
  return urls.map((raw) => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw notUploadedThroughNantty();
    }
    const base = allowedBaseUrls.find((candidate) => raw.startsWith(`${candidate}/`));
    const allowed = allowedBaseUrls.length === 0 ? parsed.protocol === "https:" : base !== undefined;
    if (!allowed || parsed.username !== "" || parsed.password !== "") throw notUploadedThroughNantty();
    const relativeSegments = (base === undefined ? parsed.pathname : raw.slice(base.length).split(/[?#]/)[0] ?? "").split("/").filter(Boolean);
    const extension = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
    return { url: parsed.toString(), contentType: contentTypeByExtension[extension] ?? null, mediaId: relativeSegments.find((segment) => uuidPattern.test(segment))?.toLowerCase() ?? null };
  });
}

export async function validateRequesterAttachments(urls: readonly string[], options: { readonly allowedBaseUrls: readonly string[]; readonly media: MediaDirectory | undefined; readonly requesterId: string }): Promise<TicketAttachment[]> {
  const attachments = validateAttachmentUrls(urls, options.allowedBaseUrls);
  if (attachments.length === 0) return [];
  if (options.media === undefined) throw new SupportError(503, "ATTACHMENTS_UNAVAILABLE", "Attachments are not available right now. Send your message without them.");
  const checked = new Map<string, boolean>();
  for (const attachment of attachments) {
    if (attachment.mediaId === null) throw notUploadedThroughNantty();
    if (!checked.has(attachment.mediaId)) {
      const record = await options.media.findMedia(attachment.mediaId);
      checked.set(attachment.mediaId, record !== null && record.ownerId.toLowerCase() === options.requesterId.toLowerCase() && !unusableStatuses.has(record.status));
    }
    if (checked.get(attachment.mediaId) !== true) throw notUploadedThroughNantty();
  }
  return attachments.map(({ url, contentType }) => ({ url, contentType }));
}

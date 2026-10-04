import { maximumAttachmentsPerMessage } from "../../../constants/support.constant.js";
import { badRequest } from "../../../errors/support.error.js";
import type { TicketAttachment } from "../../../types/ticket.type.js";

const contentTypeByExtension: Readonly<Record<string, string>> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", pdf: "application/pdf" };

export function validateAttachmentUrls(urls: readonly string[], allowedBaseUrls: readonly string[]): TicketAttachment[] {
  if (urls.length > maximumAttachmentsPerMessage) throw badRequest("TOO_MANY_ATTACHMENTS", `Attach up to ${maximumAttachmentsPerMessage} files.`);
  return urls.map((raw) => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw badRequest("INVALID_ATTACHMENT", "Attachments must be uploaded through Zudomart first.");
    }
    const allowed = allowedBaseUrls.length === 0 ? parsed.protocol === "https:" : allowedBaseUrls.some((base) => raw.startsWith(`${base}/`));
    if (!allowed || parsed.username !== "" || parsed.password !== "") throw badRequest("INVALID_ATTACHMENT", "Attachments must be uploaded through Zudomart first.");
    const extension = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
    return { url: parsed.toString(), contentType: contentTypeByExtension[extension] ?? null };
  });
}

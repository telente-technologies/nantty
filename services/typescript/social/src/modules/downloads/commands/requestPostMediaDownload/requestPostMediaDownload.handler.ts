import { SocialError, conflict, forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { PostMediaDownloadView } from "../../models/download.model.js";
import { downloadSettingRepository } from "../../repositories/downloadSetting.repository.js";
import { decidePostDownloadPermission } from "../../services/downloadPermission.service.js";
import type { RequestPostMediaDownloadCommand } from "./requestPostMediaDownload.command.js";

export function createRequestPostMediaDownloadHandler(context: HandlerContext): Handler<RequestPostMediaDownloadCommand, PostMediaDownloadView> {
  return async ({ viewerId, postId, mediaId }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    const media = post.media.find((item) => item.mediaId === mediaId);
    if (media === undefined) throw notFound("MEDIA_NOT_IN_POST", "That photo or video isn't part of this post.");
    if (media.status !== "ready") throw conflict("MEDIA_NOT_READY", "This file is still being processed.");
    const [downloadsOff, privateAccounts, authors] = await Promise.all([
      downloadSettingRepository.accountIdsWithDownloadsOff(context.database.client, [post.authorId]),
      context.directory.findPrivateAccountIds([post.authorId]),
      context.directory.findUserSummaries([post.authorId]),
    ]);
    const permission = decidePostDownloadPermission({
      viewerId, authorId: post.authorId, kind: post.kind, visibility: post.visibility, moderationVisibility: post.moderationVisibility, hasMedia: true,
      authorAllowsDownloads: !downloadsOff.has(post.authorId), authorIsPrivate: privateAccounts.has(post.authorId),
    });
    if (!permission.allowed) throw forbidden(permission.code, permission.message);
    const username = authors.get(post.authorId)?.username ?? "";
    if (context.mediaDownloads === undefined || username === "") throw new SocialError(503, "DOWNLOADS_UNAVAILABLE", "Downloads are temporarily unavailable. Try again shortly.");
    return context.mediaDownloads.requestDownloadVariant({ mediaId, requesterId: viewerId, watermarkHandle: username, stripAudio: false });
  };
}

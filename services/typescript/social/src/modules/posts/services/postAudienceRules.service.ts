import { forbidden } from "../../../errors/social.error.js";
import type { SensitiveLabel } from "../../../generated/prisma/client.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ViewerAgeBracket } from "../../../types/principal.type.js";
import { currentViewerAgeBracket } from "../../../utils/viewerAgeContext.util.js";
import { labelsWithheldFromAgeBracket, normaliseSensitiveLabels } from "./sensitiveContent.service.js";

export function assertAuthorAgeAllowsSensitiveLabels(ageBracket: ViewerAgeBracket, labels: readonly SensitiveLabel[]): void {
  const restricted = labels.filter((label) => labelsWithheldFromAgeBracket(ageBracket).includes(label));
  if (restricted.length > 0) throw forbidden("SENSITIVE_LABEL_NOT_ALLOWED", "You must be 18 or older to post this kind of content.");
}

export async function prepareAudienceSettingsForPublishing(context: HandlerContext, authorId: string, input: { readonly visibility: "public" | "subscribers"; readonly sensitiveLabels: readonly string[] | undefined }): Promise<SensitiveLabel[]> {
  if (input.visibility === "subscribers") {
    const author = (await context.directory.findUserSummaries([authorId])).get(authorId);
    if (author?.isCreator !== true) throw forbidden("CREATOR_ONLY", "Only approved creators can post for subscribers only.");
  }
  const labels = normaliseSensitiveLabels(input.sensitiveLabels ?? []);
  assertAuthorAgeAllowsSensitiveLabels(currentViewerAgeBracket(), labels);
  return labels;
}

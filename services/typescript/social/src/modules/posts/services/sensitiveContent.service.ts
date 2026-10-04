import { advisorySensitiveLabelThreshold } from "../../../constants/social.constant.js";
import type { Prisma, SensitiveLabel } from "../../../generated/prisma/client.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ViewerAgeBracket } from "../../../types/principal.type.js";
import { currentViewerAgeBracket } from "../../../utils/viewerAgeContext.util.js";

export const sensitiveLabels = ["nudity", "graphic_violence", "dangerous_acts", "self_harm"] as const satisfies readonly SensitiveLabel[];
export const labelsNeverShownToMinors = ["nudity", "dangerous_acts"] as const satisfies readonly SensitiveLabel[];

export interface ContentViewer {
  readonly viewerId: string | undefined;
  readonly ageBracket: ViewerAgeBracket;
}

export interface ViewerContentPolicy extends ContentViewer {
  readonly withheldLabels: readonly SensitiveLabel[];
  readonly showSensitiveWithoutWarning: boolean;
}

export interface SensitiveContentView {
  readonly labels: readonly SensitiveLabel[];
  readonly requiresInterstitial: boolean;
}

export interface AdvisoryLabelScore {
  readonly label: SensitiveLabel;
  readonly score: number;
}

export const guestContentPolicy: ViewerContentPolicy = { viewerId: undefined, ageBracket: "unknown", withheldLabels: labelsNeverShownToMinors, showSensitiveWithoutWarning: false };

export function labelsWithheldFromAgeBracket(ageBracket: ViewerAgeBracket): readonly SensitiveLabel[] {
  return ageBracket === "adult" ? [] : labelsNeverShownToMinors;
}

export function buildViewerContentPolicy(viewer: ContentViewer, showSensitiveWithoutWarning: boolean): ViewerContentPolicy {
  return { ...viewer, withheldLabels: labelsWithheldFromAgeBracket(viewer.ageBracket), showSensitiveWithoutWarning: viewer.ageBracket === "adult" && showSensitiveWithoutWarning };
}

export async function resolveViewerContentPolicy(context: HandlerContext, viewer: ContentViewer): Promise<ViewerContentPolicy> {
  if (viewer.viewerId === undefined || viewer.ageBracket !== "adult") return buildViewerContentPolicy(viewer, false);
  const preference = await context.database.client.contentPreference.findUnique({ where: { accountId: viewer.viewerId }, select: { showSensitiveWithoutWarning: true } });
  return buildViewerContentPolicy(viewer, preference?.showSensitiveWithoutWarning === true);
}

export function resolveCurrentViewerContentPolicy(context: HandlerContext, viewerId: string | undefined): Promise<ViewerContentPolicy> {
  return resolveViewerContentPolicy(context, { viewerId, ageBracket: currentViewerAgeBracket() });
}

export function sensitiveLabelFilterForViewer(policy: Pick<ViewerContentPolicy, "withheldLabels">): Prisma.PostWhereInput {
  return policy.withheldLabels.length === 0 ? {} : { NOT: { sensitiveLabels: { hasSome: [...policy.withheldLabels] } } };
}

export function isPostWithheldFromViewer(post: { readonly authorId: string; readonly sensitiveLabels: readonly SensitiveLabel[] }, policy: Pick<ViewerContentPolicy, "viewerId" | "withheldLabels">): boolean {
  if (policy.viewerId !== undefined && policy.viewerId === post.authorId) return false;
  return post.sensitiveLabels.some((label) => policy.withheldLabels.includes(label));
}

export function buildSensitiveContentView(post: { readonly authorId: string; readonly sensitiveLabels: readonly SensitiveLabel[] }, policy: Pick<ViewerContentPolicy, "viewerId" | "showSensitiveWithoutWarning">): SensitiveContentView | null {
  if (post.sensitiveLabels.length === 0) return null;
  const isAuthor = policy.viewerId !== undefined && policy.viewerId === post.authorId;
  return { labels: [...post.sensitiveLabels], requiresInterstitial: !isAuthor && !policy.showSensitiveWithoutWarning };
}

export function normaliseSensitiveLabels(values: readonly unknown[]): SensitiveLabel[] {
  return sensitiveLabels.filter((label) => values.includes(label));
}

export function advisoryLabelsAboveThreshold(scores: readonly AdvisoryLabelScore[]): SensitiveLabel[] {
  return normaliseSensitiveLabels(scores.filter((entry) => entry.score >= advisorySensitiveLabelThreshold).map((entry) => entry.label));
}

export function computeEffectiveSensitiveLabels(input: {
  readonly author: readonly SensitiveLabel[];
  readonly moderation: readonly SensitiveLabel[];
  readonly advisory: readonly SensitiveLabel[];
  readonly reviewedByModeration: boolean;
}): SensitiveLabel[] {
  const reviewed = input.reviewedByModeration ? input.moderation : [...input.moderation, ...input.advisory];
  return normaliseSensitiveLabels([...input.author, ...reviewed]);
}

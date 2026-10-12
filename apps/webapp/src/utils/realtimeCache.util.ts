import type { CategorizedNotification, NotificationCategory } from "@/types/commerce.type";
import type { LiveComment, Page, UserSummary } from "@/types";

export interface RealtimeEventLike {
  readonly type: string;
  readonly [field: string]: unknown;
}

const conversationEventTypes = new Set(["message.created", "message.updated", "message.removed", "reaction", "read", "conversation.updated"]);
const notificationCategories = new Set<NotificationCategory>(["orders", "social", "system"]);
const liveCommentKinds = new Set<LiveComment["kind"]>(["comment", "joined", "reply", "gift"]);
const maximumLiveComments = 200;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const readText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

export interface ChatEventEffect {
  readonly conversationId: string | null;
  readonly refreshesThread: boolean;
}

export function readChatEventEffect(event: RealtimeEventLike): ChatEventEffect | null {
  if (!conversationEventTypes.has(event.type)) return null;
  const message = isRecord(event.message) ? event.message : null;
  const conversation = isRecord(event.conversation) ? event.conversation : null;
  const conversationId = readText(event.conversationId) ?? readText(message?.conversationId) ?? readText(conversation?.id);
  return { conversationId, refreshesThread: event.type !== "conversation.updated" };
}

export interface TypingSignal {
  readonly conversationId: string;
  readonly userId: string;
  readonly name: string | null;
  readonly isTyping: boolean;
}

export function readTypingSignal(event: RealtimeEventLike): TypingSignal | null {
  if (event.type !== "typing") return null;
  const user = isRecord(event.user) ? event.user : null;
  const conversationId = readText(event.conversationId);
  const userId = readText(user?.id);
  if (!conversationId || !userId) return null;
  return { conversationId, userId, name: readText(user?.name) ?? readText(user?.username), isTyping: event.isTyping === true };
}

function readUserSummary(value: unknown): UserSummary | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id);
  const username = readText(value.username) ?? "";
  const name = readText(value.name) ?? username;
  if (!id || !name) return null;
  return { id, name, username, avatarUrl: readText(value.avatarUrl), verified: value.verified === true };
}

export function readRealtimeNotification(event: RealtimeEventLike): CategorizedNotification | null {
  if (event.type !== "notification.created" || !isRecord(event.notification)) return null;
  const raw = event.notification;
  const id = readText(raw.id);
  const title = typeof raw.title === "string" ? raw.title : null;
  const body = typeof raw.body === "string" ? raw.body : null;
  if (!id || title === null || body === null) return null;
  const category = notificationCategories.has(raw.category as NotificationCategory) ? (raw.category as NotificationCategory) : "system";
  return { ...(raw as object), id, title, body, category, createdAt: readText(raw.createdAt) ?? new Date().toISOString(), read: raw.read === true, actor: readUserSummary(raw.actor) } as CategorizedNotification;
}

export function upsertNotification(list: readonly CategorizedNotification[] | undefined, notification: CategorizedNotification): CategorizedNotification[] | undefined {
  if (!list) return undefined;
  if (list.some((existing) => existing.id === notification.id)) return list as CategorizedNotification[];
  return [notification, ...list];
}

export function readRealtimeLiveComment(event: RealtimeEventLike, liveId: string): LiveComment | null {
  if (event.type !== "live.comment" || event.liveId !== liveId) return null;
  const id = readText(event.id);
  const author = readUserSummary(event.author);
  if (!id || !author || typeof event.text !== "string") return null;
  const kind = liveCommentKinds.has(event.kind as LiveComment["kind"]) ? (event.kind as LiveComment["kind"]) : "comment";
  return { id, author, text: event.text, kind };
}

export function prependLiveComment(page: Page<LiveComment> | undefined, comment: LiveComment): Page<LiveComment> | undefined {
  if (!page || page.data.some((existing) => existing.id === comment.id)) return page;
  return { ...page, data: [comment, ...page.data].slice(0, maximumLiveComments) };
}

export function removeLiveComment(page: Page<LiveComment> | undefined, commentId: string): Page<LiveComment> | undefined {
  if (!page || !page.data.some((existing) => existing.id === commentId)) return page;
  return { ...page, data: page.data.filter((existing) => existing.id !== commentId) };
}

export function readLiveViewerCount(event: RealtimeEventLike, liveId: string): number | null {
  if (event.type !== "live.viewerCount" || event.liveId !== liveId) return null;
  return typeof event.viewers === "number" && Number.isFinite(event.viewers) && event.viewers >= 0 ? Math.floor(event.viewers) : null;
}

const liveStateEventTypes = new Set(["live.started", "live.ended", "live.safety.paused", "live.safety.resumed", "live.room.settings", "live.topSupporter"]);

export function shouldRefreshLiveSession(event: RealtimeEventLike, liveId: string): boolean {
  return event.liveId === liveId && liveStateEventTypes.has(event.type);
}

export function shouldRefreshLiveComments(event: RealtimeEventLike, liveId: string): boolean {
  return event.liveId === liveId && (event.type === "gift.sent" || event.type === "live.comment.pinned" || event.type === "live.comment.unpinned");
}

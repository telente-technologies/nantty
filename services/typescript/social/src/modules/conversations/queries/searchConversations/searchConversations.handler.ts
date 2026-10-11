import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { buildConversationViews } from "../../services/conversationView.service.js";
import type { SearchConversationsQuery } from "./searchConversations.query.js";

export interface ChatSearchResults {
  readonly conversations: readonly { readonly id: string; readonly peer: UserSummary; readonly snippet: string }[];
  readonly people: readonly UserSummary[];
}

export function createSearchConversationsHandler(context: HandlerContext): Handler<SearchConversationsQuery, ChatSearchResults> {
  return async ({ viewerId, term }) => {
    const needle = term.trim().toLowerCase();
    if (needle === "") return { conversations: [], people: [] };
    const [rows, people] = await Promise.all([conversationRepository.pageForMember(context.database.client, viewerId, "chats", undefined, 100, undefined), context.directory.searchUserSummaries(needle, 10)]);
    const views = await buildConversationViews(context, viewerId, rows.slice(0, 100));
    const matches = views.filter((view) => view.kind !== "group" && `${view.peer.name} ${view.peer.username} ${view.title ?? ""}`.toLowerCase().includes(needle));
    return { conversations: matches.map((view) => ({ id: view.id, peer: view.peer, snippet: "" })), people: people.filter((person) => person.id !== viewerId) };
  };
}

export type MessengerSurface = "chats" | "stories" | "settings";

export function shouldShowFloatingConversations(surface: MessengerSurface, conversationOpen: boolean): boolean {
  return surface !== "settings" && !conversationOpen;
}

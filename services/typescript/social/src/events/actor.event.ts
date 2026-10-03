import type { IdentityDirectory } from "../interfaces/identityDirectory.interface.js";

export type EventActor = { readonly id: string; readonly name: string };

export async function resolveEventActor(directory: IdentityDirectory, accountId: string): Promise<EventActor> {
  const summary = (await directory.findUserSummaries([accountId])).get(accountId);
  return { id: accountId, name: summary?.name === undefined || summary.name === "" ? (summary?.username ?? "Someone") : summary.name };
}

export function buildExcerpt(text: string, maximumLength = 120): string {
  return text.length <= maximumLength ? text : `${text.slice(0, maximumLength - 1)}…`;
}

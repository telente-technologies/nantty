import { execFileSync } from "node:child_process";

import { socialDatabaseUrl } from "../environment.js";

export interface StoredMessageRow {
  readonly id: string;
  readonly kind: string;
  readonly ciphertext: string;
  readonly protocol: string;
  readonly sharedContent: string;
  readonly mentions: string;
}

export function readStoredMessages(conversationId: string): StoredMessageRow[] {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new Error(`not a conversation id: ${conversationId}`);
  const sql = `select id, kind, coalesce(ciphertext,''), protocol, coalesce("sharedContent"::text,''), mentions::text from social.messages where "conversationId" = '${conversationId}' order by "createdAt"`;
  const output = execFileSync("psql", [socialDatabaseUrl, "-At", "-F", "\u001f", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output.split("\n").filter((line) => line !== "").map((line) => {
    const [id = "", kind = "", ciphertext = "", protocol = "", sharedContent = "", mentions = ""] = line.split("\u001f");
    return { id, kind, ciphertext, protocol, sharedContent, mentions };
  });
}

export function searchMessagesTableForText(needle: string): number {
  const escaped = needle.replace(/'/g, "''");
  const output = execFileSync("psql", [socialDatabaseUrl, "-At", "-c", `select count(*) from social.messages m where m::text ilike '%${escaped}%'`], { encoding: "utf8" });
  return Number(output.trim());
}

import { createHash, createHmac } from "node:crypto";

const HASHED_USER_PREFIX = "u_";
const HASHED_QUERY_PREFIX = "q_";
const HASH_HEX_LENGTH = 40;

export class OpaqueIdentifierHasher {
  private readonly secret: Buffer;

  public constructor(configuredSecret: string, dataEncryptionKey: Uint8Array) {
    this.secret = configuredSecret === ""
      ? createHmac("sha256", Buffer.from(dataEncryptionKey)).update("zudomart:intelligence:user-id-hash").digest()
      : Buffer.from(configuredSecret, "utf8");
  }

  public hashUserId(userId: string): string {
    return HASHED_USER_PREFIX + createHmac("sha256", this.secret).update(`user:${userId}`).digest("hex").slice(0, HASH_HEX_LENGTH);
  }

  public hashSearchQuery(queryText: string): string {
    const normalizedQuery = queryText.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    return HASHED_QUERY_PREFIX + createHmac("sha256", this.secret).update(`query:${normalizedQuery}`).digest("hex").slice(0, HASH_HEX_LENGTH);
  }

  public createUserIdLookup(userIds: readonly string[]): Map<string, string> {
    return new Map(userIds.map((userId) => [this.hashUserId(userId), userId]));
  }
}

export function createDeterministicEventId(parts: readonly string[]): string {
  return `evt_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)}`;
}

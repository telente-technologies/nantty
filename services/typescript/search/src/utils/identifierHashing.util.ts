import { createHmac } from "node:crypto";

const hashedUserPrefix = "u_";
const hashedQueryPrefix = "q_";
const hashHexLength = 40;

export interface IdentifierHasher {
  hashUserId(userId: string): string;
  hashSearchQuery(queryText: string): string;
}

export function deriveIdentifierHashSecret(configuredSecret: string, fallbackKeyMaterial: string): Buffer {
  return configuredSecret === ""
    ? createHmac("sha256", Buffer.from(fallbackKeyMaterial, "utf8")).update("zudomart:intelligence:user-id-hash").digest()
    : Buffer.from(configuredSecret, "utf8");
}

export function createIdentifierHasher(secret: Buffer): IdentifierHasher {
  const digest = (input: string) => createHmac("sha256", secret).update(input).digest("hex").slice(0, hashHexLength);
  return {
    hashUserId: (userId) => hashedUserPrefix + digest(`user:${userId}`),
    hashSearchQuery: (queryText) => hashedQueryPrefix + digest(`query:${queryText.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")}`),
  };
}

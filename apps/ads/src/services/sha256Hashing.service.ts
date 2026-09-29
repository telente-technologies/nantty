export async function calculateSha256HexOfBytes(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes instanceof Uint8Array ? (bytes as Uint8Array<ArrayBuffer>) : bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function calculateSha256HexOfText(text: string): Promise<string> {
  return calculateSha256HexOfBytes(new TextEncoder().encode(text));
}

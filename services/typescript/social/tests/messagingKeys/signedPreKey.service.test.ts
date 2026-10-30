import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import { isValidAgreementKey, isValidSignedPreKey } from "../../src/modules/messagingKeys/services/signedPreKey.service.js";

const clientVector = {
  identityKey: "dS2RAeY/X0R+EGlt0xLmZrOZXGyod70QS2CpqNI9doM=",
  signedPreKey: { keyId: 42, publicKey: "54KqbhFd3JXTW5+qrZZvt6iBUtAw57rKjwT34GtbyXI=", signature: "BG0F/4Qc1RuwH36Xr4bFLn6BwgCWO1DPWanxcWOfxvMKpRvorhplor6EsfZUxEnO3UMrsu3Sf0m3WVlO4uQ1CQ==" },
};

describe("signed prekey verification", () => {
  it("accepts a signed prekey produced by @nantty/chat-crypto", () => {
    // Run the actual client through its TS loader without pulling client source
    // into the server's compilation boundary or adding a production dependency.
    const keys = new URL("../../../../../packages/chatCrypto/src/keys.ts", import.meta.url).href;
    const random = new URL("../../../../../packages/chatCrypto/tests/testRandom.ts", import.meta.url).href;
    const generated = execFileSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "--eval", `
      import { createDeviceIdentity, createSignedPreKey } from ${JSON.stringify(keys)};
      import { seededRandom } from ${JSON.stringify(random)};
      const random = seededRandom("social-signed-prekey-contract");
      const identity = createDeviceIdentity("alice", random);
      const key = createSignedPreKey(identity, 42, random, 0);
      console.log(JSON.stringify({ identityKey: Buffer.from(identity.signing.publicKey).toString("base64"), signedPreKey: { keyId: key.keyId, publicKey: Buffer.from(key.keyPair.publicKey).toString("base64"), signature: Buffer.from(key.signature).toString("base64") } }));
    `], { encoding: "utf8", timeout: 10_000 });
    expect(JSON.parse(generated)).toEqual(clientVector);
    expect(isValidSignedPreKey(clientVector.identityKey, clientVector.signedPreKey)).toBe(true);
  });

  it("rejects a prekey signed under the former protocol label", () => {
    expect(isValidSignedPreKey("Vx5Ilwlkfg5uiTsVbgqfbReYGQwujad1XPjGW8KiI0o=", {
      keyId: 42, publicKey: "8mWXVaBnr8A8pf9oqOxp1/vhV2yh3JpKul3K9Mus+ik=",
      signature: "8N4qgR6H5t9jfUXbLwwaHhY6gvwpfs2onx7Vcimd/vXhmhLcpGQJJVppYDQ7D9G16eKYkXvIhbySZuzwlQmABw==",
    })).toBe(false);
  });

  it("rejects a signature moved to another key id, key or identity", () => {
    expect(isValidSignedPreKey(clientVector.identityKey, { ...clientVector.signedPreKey, keyId: 43 })).toBe(false);
    expect(isValidSignedPreKey(clientVector.identityKey, { ...clientVector.signedPreKey, publicKey: clientVector.identityKey })).toBe(false);
    expect(isValidSignedPreKey(clientVector.signedPreKey.publicKey, clientVector.signedPreKey)).toBe(false);
    expect(isValidSignedPreKey("not-base64", clientVector.signedPreKey)).toBe(false);
  });

  it("only accepts canonical 32-byte keys", () => {
    expect(isValidAgreementKey(clientVector.signedPreKey.publicKey)).toBe(true);
    expect(isValidAgreementKey("AAAA")).toBe(false);
  });
});

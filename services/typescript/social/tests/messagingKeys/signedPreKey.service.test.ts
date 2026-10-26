import { describe, expect, it } from "vitest";

import { isValidAgreementKey, isValidSignedPreKey } from "../../src/modules/messagingKeys/services/signedPreKey.service.js";

const clientVector = {
  identityKey: "Vx5Ilwlkfg5uiTsVbgqfbReYGQwujad1XPjGW8KiI0o=",
  signedPreKey: { keyId: 42, publicKey: "8mWXVaBnr8A8pf9oqOxp1/vhV2yh3JpKul3K9Mus+ik=", signature: "8N4qgR6H5t9jfUXbLwwaHhY6gvwpfs2onx7Vcimd/vXhmhLcpGQJJVppYDQ7D9G16eKYkXvIhbySZuzwlQmABw==" },
};

describe("signed prekey verification", () => {
  it("accepts a signed prekey produced by @nantty/chat-crypto", () => {
    expect(isValidSignedPreKey(clientVector.identityKey, clientVector.signedPreKey)).toBe(true);
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

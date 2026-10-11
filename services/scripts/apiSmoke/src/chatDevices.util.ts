import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import type { UserActor } from "./actors.util.js";
import { callApi, describeResponse } from "./apiClient.util.js";

const signedPreKeyLabel = Buffer.from("zudomart-signed-prekey-v1", "utf8");

function rawPublicKey(publicKey: KeyObject): Buffer {
  return Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url");
}

export async function registerChatDevice(user: UserActor, deviceId: string): Promise<void> {
  const identity = generateKeyPairSync("ed25519");
  const preKey = generateKeyPairSync("x25519");
  const preKeyPublic = rawPublicKey(preKey.publicKey);
  const keyId = Buffer.alloc(4);
  keyId.writeUInt32BE(1);
  const signature = sign(null, Buffer.concat([signedPreKeyLabel, keyId, preKeyPublic]), identity.privateKey);
  const oneTimePreKeys = [2, 3].map((id) => ({ keyId: id, publicKey: rawPublicKey(generateKeyPairSync("x25519").publicKey).toString("base64") }));
  const registered = await callApi("PUT", `/api/v1/chat/keys/devices/${deviceId}`, {
    token: user.accessToken,
    idempotent: false,
    body: {
      registrationId: 1 + Math.floor(Math.random() * 16_000),
      identityKey: rawPublicKey(identity.publicKey).toString("base64"),
      signedPreKey: { keyId: 1, publicKey: preKeyPublic.toString("base64"), signature: signature.toString("base64") },
      oneTimePreKeys,
    },
  });
  if (registered.status >= 300) throw new Error(`register chat device: ${describeResponse(registered)}`);
}

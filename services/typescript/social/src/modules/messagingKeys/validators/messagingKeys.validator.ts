import { schema } from "@nantty/fastify-platform";

import { maximumDevicesPerQuery, maximumOneTimePreKeysPerUpload } from "../repositories/deviceKey.repository.js";
import { maximumMailboxCiphertextLength, maximumMailboxEntriesPerDeposit } from "../repositories/keyMailbox.repository.js";

const keyId = schema.number().int().min(1).max(0x7fffffff);
const base64Key = schema.string().min(40).max(48);
const signedPreKeySchema = schema.object({ keyId, publicKey: base64Key, signature: schema.string().min(84).max(92) });
const oneTimePreKeySchema = schema.object({ keyId, publicKey: base64Key });
const oneTimePreKeysSchema = schema.array(oneTimePreKeySchema).max(maximumOneTimePreKeysPerUpload);

export const deviceParamsSchema = schema.object({ deviceId: schema.string().regex(/^[A-Za-z0-9_-]{8,64}$/) });
export const registerDeviceBodySchema = schema.object({ registrationId: schema.number().int().min(1).max(0x7fffffff), identityKey: base64Key, signedPreKey: signedPreKeySchema, oneTimePreKeys: oneTimePreKeysSchema });
export const uploadOneTimePreKeysBodySchema = schema.object({ oneTimePreKeys: oneTimePreKeysSchema.min(1) });
export const rotateSignedPreKeyBodySchema = schema.object({ signedPreKey: signedPreKeySchema });
export const listDevicesBodySchema = schema.object({ userIds: schema.array(schema.string().uuid()).min(1).max(maximumDevicesPerQuery) });
export const claimBundlesBodySchema = schema.object({
  devices: schema.array(schema.object({ userId: schema.string().uuid(), deviceId: schema.string().min(1).max(64) })).min(1).max(maximumDevicesPerQuery),
});
export const depositMailboxBodySchema = schema.object({
  senderDeviceId: schema.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  conversationId: schema.string().uuid(),
  entries: schema.array(schema.object({ userId: schema.string().uuid(), deviceId: schema.string().min(1).max(64), ciphertext: schema.string().min(1).max(maximumMailboxCiphertextLength) })).min(1).max(maximumMailboxEntriesPerDeposit),
});
export const acknowledgeMailboxBodySchema = schema.object({ ids: schema.array(schema.string().uuid()).min(1).max(500) });

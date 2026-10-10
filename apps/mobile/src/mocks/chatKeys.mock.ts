import { createMockKeyDirectoryBackend, type DeviceAddress, type DeviceRegistrationRequest, type MailboxEntryInput, type WireOneTimePreKey, type WireSignedPreKey } from "@zudomart/chat-crypto";

import { ApiError } from "@/errors/api.error";
import { randomBytesFromDevice } from "@/services/chatCrypto/mobileKeyStore";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const backend = createMockKeyDirectoryBackend({ shouldProvisionPeer: (userId) => userId !== getSignedInMockUser().id, random: randomBytesFromDevice });
const viewerId = () => getSignedInMockUser().id;

async function asApiError<T>(run: () => T | Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = (error as { code?: string }).code ?? "INVALID";
    throw new ApiError(code === "DEVICE_NOT_FOUND" ? 404 : 422, "Secure chat keys were rejected.", code);
  }
}

export const chatKeysMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/chat/keys/mailbox", ({ body }) => {
    const input = (body ?? {}) as { senderDeviceId?: string; conversationId?: string; entries?: MailboxEntryInput[] };
    backend.depositMailbox(viewerId(), input.senderDeviceId ?? "", input.conversationId ?? "", input.entries ?? []);
    return { accepted: input.entries?.length ?? 0 };
  }),
  createMockRoute("GET", "/api/v1/chat/keys/devices/:deviceId/mailbox", ({ params }) => backend.fetchMailbox(viewerId(), params.deviceId!)),
  createMockRoute("POST", "/api/v1/chat/keys/devices/:deviceId/mailbox/ack", ({ params, body }) => {
    backend.acknowledgeMailbox(viewerId(), params.deviceId!, ((body ?? {}) as { ids?: string[] }).ids ?? []);
    return { removed: 0 };
  }),
  createMockRoute("POST", "/api/v1/chat/keys/devices/query", ({ body }) => backend.listDevices(((body ?? {}) as { userIds?: string[] }).userIds ?? [])),
  createMockRoute("POST", "/api/v1/chat/keys/bundles", ({ body }) => backend.claimBundles(((body ?? {}) as { devices?: DeviceAddress[] }).devices ?? [])),
  createMockRoute("PUT", "/api/v1/chat/keys/devices/:deviceId", ({ params, body }) => asApiError(() => backend.register(viewerId(), params.deviceId!, body as DeviceRegistrationRequest))),
  createMockRoute("GET", "/api/v1/chat/keys/devices/:deviceId", ({ params }) => {
    const status = backend.status(viewerId(), params.deviceId!);
    if (status === null) throw new ApiError(404, "This device is not registered for secure chat.", "DEVICE_NOT_FOUND");
    return status;
  }),
  createMockRoute("DELETE", "/api/v1/chat/keys/devices/:deviceId", ({ params }) => backend.remove(viewerId(), params.deviceId!)),
  createMockRoute("POST", "/api/v1/chat/keys/devices/:deviceId/prekeys", ({ params, body }) =>
    asApiError(() => backend.uploadOneTimePreKeys(viewerId(), params.deviceId!, ((body ?? {}) as { oneTimePreKeys?: WireOneTimePreKey[] }).oneTimePreKeys ?? []))),
  createMockRoute("PUT", "/api/v1/chat/keys/devices/:deviceId/signed-prekey", ({ params, body }) =>
    asApiError(() => backend.rotateSignedPreKey(viewerId(), params.deviceId!, ((body ?? {}) as { signedPreKey: WireSignedPreKey }).signedPreKey))),
];

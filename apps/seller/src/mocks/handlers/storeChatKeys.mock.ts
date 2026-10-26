import { ChatCryptoClient, type DeviceAddress, type DeviceRegistrationRequest, InMemoryKeyDirectory, type MailboxEntryInput, MemoryKeyValueStore, type WireOneTimePreKey, type WireSignedPreKey } from "@nantty/chat-crypto";

import { MockHttpError, readJsonObjectBody, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";

export const demoTeammateId = "usr_demo_teammate";

const directory = new InMemoryKeyDirectory();
const demoClients = new Map<string, Promise<ChatCryptoClient>>();

export function demoChatClient(userId: string): Promise<ChatCryptoClient> {
  let pending = demoClients.get(userId);
  if (pending === undefined) {
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), allowMissingRecipients: true });
    pending = client.ensureReady(userId).then(() => client);
    demoClients.set(userId, pending);
  }
  return pending;
}

export const hasRegisteredDevice = (userId: string): boolean => (directory.list([userId])[0]?.devices.length ?? 0) > 0;

function viewerOf(request: MockRequest): string {
  if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.principal.userId;
}

async function keysCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID";
    throw new MockHttpError(code === "DEVICE_NOT_FOUND" ? 404 : 422, code, "Secure chat keys were rejected.");
  }
}

export function registerStoreChatKeyMockHandlers(): void {
  const forViewer = (request: MockRequest) => directory.forUser(viewerOf(request));
  const deviceId = (request: MockRequest) => request.params.deviceId ?? "";
  registerMockRoute("PUT", "/chat/keys/devices/:deviceId", async (request) => respondWithJson(200, await keysCall(() => forViewer(request).registerDevice(deviceId(request), request.jsonBody as DeviceRegistrationRequest))));
  registerMockRoute("GET", "/chat/keys/devices/:deviceId", async (request) => {
    const status = await forViewer(request).fetchDeviceStatus(deviceId(request));
    if (status === null) throw new MockHttpError(404, "DEVICE_NOT_FOUND", "This device is not registered for secure chat.");
    return respondWithJson(200, status);
  });
  registerMockRoute("DELETE", "/chat/keys/devices/:deviceId", async (request) => {
    await forViewer(request).removeDevice(deviceId(request));
    return respondWithJson(200, {});
  });
  registerMockRoute("POST", "/chat/keys/devices/:deviceId/prekeys", async (request) =>
    respondWithJson(200, await keysCall(() => forViewer(request).uploadOneTimePreKeys(deviceId(request), (readJsonObjectBody(request).oneTimePreKeys ?? []) as WireOneTimePreKey[]))));
  registerMockRoute("PUT", "/chat/keys/devices/:deviceId/signed-prekey", async (request) =>
    respondWithJson(200, await keysCall(() => forViewer(request).rotateSignedPreKey(deviceId(request), readJsonObjectBody(request).signedPreKey as WireSignedPreKey))));
  registerMockRoute("POST", "/chat/keys/devices/query", async (request) => respondWithJson(200, { data: await forViewer(request).listDevices((readJsonObjectBody(request).userIds ?? []) as string[]) }));
  registerMockRoute("POST", "/chat/keys/bundles", async (request) => respondWithJson(200, { data: await forViewer(request).claimPreKeyBundles((readJsonObjectBody(request).devices ?? []) as DeviceAddress[]) }));
  registerMockRoute("POST", "/chat/keys/mailbox", async (request) => {
    const body = readJsonObjectBody(request) as { senderDeviceId?: string; conversationId?: string; entries?: MailboxEntryInput[] };
    await forViewer(request).depositMailbox(body.senderDeviceId ?? "", body.conversationId ?? "", body.entries ?? []);
    return respondWithJson(200, { accepted: body.entries?.length ?? 0 });
  });
  registerMockRoute("GET", "/chat/keys/devices/:deviceId/mailbox", async (request) => respondWithJson(200, { data: await forViewer(request).fetchMailbox(deviceId(request)) }));
  registerMockRoute("POST", "/chat/keys/devices/:deviceId/mailbox/ack", async (request) => {
    await forViewer(request).acknowledgeMailbox(deviceId(request), (readJsonObjectBody(request).ids ?? []) as string[]);
    return respondWithJson(200, { removed: 0 });
  });
}

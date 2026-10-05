import { notFound } from "../../../errors/social.error.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { DeviceKeyStatusView, PreKeyBundleView, RegisterDeviceCommand, UserDevicesView, WireOneTimePreKey, WireSignedPreKey } from "../models/messagingKeys.model.js";
import type { MailboxEntryView } from "../commands/keyMailbox/keyMailbox.handler.js";
import { acknowledgeMailboxBodySchema, claimBundlesBodySchema, depositMailboxBodySchema, deviceParamsSchema, listDevicesBodySchema, registerDeviceBodySchema, rotateSignedPreKeyBodySchema, uploadOneTimePreKeysBodySchema } from "../validators/messagingKeys.validator.js";

type DeviceInput = { readonly accountId: string; readonly deviceId: string };

export interface MessagingKeysHandlers {
  readonly registerDevice: Handler<RegisterDeviceCommand, DeviceKeyStatusView>;
  readonly uploadOneTimePreKeys: Handler<DeviceInput & { readonly oneTimePreKeys: readonly WireOneTimePreKey[] }, DeviceKeyStatusView>;
  readonly rotateSignedPreKey: Handler<DeviceInput & { readonly signedPreKey: WireSignedPreKey }, DeviceKeyStatusView>;
  readonly getDeviceStatus: Handler<DeviceInput, DeviceKeyStatusView | null>;
  readonly removeDevice: Handler<DeviceInput, void>;
  readonly listDevices: Handler<{ readonly userIds: readonly string[] }, { readonly data: UserDevicesView[] }>;
  readonly claimPreKeyBundles: Handler<{ readonly requesterId: string; readonly devices: readonly { readonly userId: string; readonly deviceId: string }[] }, { readonly data: PreKeyBundleView[] }>;
  readonly depositMailbox: Handler<{ readonly senderId: string; readonly senderDeviceId: string; readonly conversationId: string; readonly entries: readonly { readonly userId: string; readonly deviceId: string; readonly ciphertext: string }[] }, { readonly accepted: number }>;
  readonly readMailbox: Handler<DeviceInput, { readonly data: MailboxEntryView[] }>;
  readonly acknowledgeMailbox: Handler<DeviceInput & { readonly ids: readonly string[] }, { readonly removed: number }>;
}

export function createMessagingKeysController(route: RouteFactory, handlers: MessagingKeysHandlers) {
  const device = { authentication: "required", params: deviceParamsSchema } as const;
  return {
    register: route({ ...device, body: registerDeviceBodySchema }, ({ principal, params, body }) => handlers.registerDevice({ accountId: principal.accountId, deviceId: params.deviceId, ...body })),
    status: route(device, async ({ principal, params }) => {
      const status = await handlers.getDeviceStatus({ accountId: principal.accountId, deviceId: params.deviceId });
      if (status === null) throw notFound("DEVICE_NOT_FOUND", "This device is not registered for secure chat.");
      return status;
    }),
    remove: route({ ...device, successStatus: 204 }, ({ principal, params }) => handlers.removeDevice({ accountId: principal.accountId, deviceId: params.deviceId })),
    uploadOneTimePreKeys: route({ ...device, body: uploadOneTimePreKeysBodySchema }, ({ principal, params, body }) =>
      handlers.uploadOneTimePreKeys({ accountId: principal.accountId, deviceId: params.deviceId, oneTimePreKeys: body.oneTimePreKeys })),
    rotateSignedPreKey: route({ ...device, body: rotateSignedPreKeyBodySchema }, ({ principal, params, body }) =>
      handlers.rotateSignedPreKey({ accountId: principal.accountId, deviceId: params.deviceId, signedPreKey: body.signedPreKey })),
    listDevices: route({ authentication: "required", body: listDevicesBodySchema }, ({ body }) => handlers.listDevices({ userIds: body.userIds })),
    claimBundles: route({ authentication: "required", body: claimBundlesBodySchema }, ({ principal, body }) => handlers.claimPreKeyBundles({ requesterId: principal.accountId, devices: body.devices })),
    depositMailbox: route({ authentication: "required", body: depositMailboxBodySchema, successStatus: 201 }, ({ principal, body }) => handlers.depositMailbox({ senderId: principal.accountId, ...body })),
    readMailbox: route(device, ({ principal, params }) => handlers.readMailbox({ accountId: principal.accountId, deviceId: params.deviceId })),
    acknowledgeMailbox: route({ ...device, body: acknowledgeMailboxBodySchema }, ({ principal, params, body }) => handlers.acknowledgeMailbox({ accountId: principal.accountId, deviceId: params.deviceId, ids: body.ids })),
  };
}

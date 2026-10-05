export interface WireSignedPreKey {
  readonly keyId: number;
  readonly publicKey: string;
  readonly signature: string;
}

export interface WireOneTimePreKey {
  readonly keyId: number;
  readonly publicKey: string;
}

export interface DeviceRegistrationRequest {
  readonly registrationId: number;
  readonly identityKey: string;
  readonly signedPreKey: WireSignedPreKey;
  readonly oneTimePreKeys: readonly WireOneTimePreKey[];
}

export interface DeviceKeyStatus {
  readonly deviceId: string;
  readonly identityKey: string;
  readonly signedPreKeyId: number;
  readonly oneTimePreKeyCount: number;
}

export interface DirectoryDevice {
  readonly deviceId: string;
  readonly registrationId: number;
  readonly identityKey: string;
}

export interface UserDeviceList {
  readonly userId: string;
  readonly devices: readonly DirectoryDevice[];
}

export interface PreKeyBundle {
  readonly userId: string;
  readonly deviceId: string;
  readonly registrationId: number;
  readonly identityKey: string;
  readonly signedPreKey: WireSignedPreKey;
  readonly oneTimePreKey: WireOneTimePreKey | null;
}

export interface DeviceAddress {
  readonly userId: string;
  readonly deviceId: string;
}

export interface KeyDirectory {
  registerDevice(deviceId: string, request: DeviceRegistrationRequest): Promise<DeviceKeyStatus>;
  fetchDeviceStatus(deviceId: string): Promise<DeviceKeyStatus | null>;
  uploadOneTimePreKeys(deviceId: string, oneTimePreKeys: readonly WireOneTimePreKey[]): Promise<DeviceKeyStatus>;
  rotateSignedPreKey(deviceId: string, signedPreKey: WireSignedPreKey): Promise<DeviceKeyStatus>;
  listDevices(userIds: readonly string[]): Promise<UserDeviceList[]>;
  claimPreKeyBundles(devices: readonly DeviceAddress[]): Promise<PreKeyBundle[]>;
  removeDevice(deviceId: string): Promise<void>;
}

export const keyDirectoryPaths = {
  device: (deviceId: string) => `/api/v1/chat/keys/devices/${encodeURIComponent(deviceId)}`,
  oneTimePreKeys: (deviceId: string) => `/api/v1/chat/keys/devices/${encodeURIComponent(deviceId)}/prekeys`,
  signedPreKey: (deviceId: string) => `/api/v1/chat/keys/devices/${encodeURIComponent(deviceId)}/signed-prekey`,
  deviceQuery: "/api/v1/chat/keys/devices/query",
  bundleClaim: "/api/v1/chat/keys/bundles",
} as const;

export interface KeyDirectoryTransport {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete(path: string): Promise<void>;
  isNotFound(error: unknown): boolean;
}

const listOf = <T>(payload: unknown): T[] => (Array.isArray(payload) ? payload : [...(((payload ?? {}) as { data?: readonly T[] }).data ?? [])]) as T[];

export function createHttpKeyDirectory(transport: KeyDirectoryTransport): KeyDirectory {
  return {
    registerDevice: (deviceId, request) => transport.put<DeviceKeyStatus>(keyDirectoryPaths.device(deviceId), request),
    fetchDeviceStatus: async (deviceId) => {
      try {
        return await transport.get<DeviceKeyStatus>(keyDirectoryPaths.device(deviceId));
      } catch (error) {
        if (transport.isNotFound(error)) return null;
        throw error;
      }
    },
    uploadOneTimePreKeys: (deviceId, oneTimePreKeys) => transport.post<DeviceKeyStatus>(keyDirectoryPaths.oneTimePreKeys(deviceId), { oneTimePreKeys }),
    rotateSignedPreKey: (deviceId, signedPreKey) => transport.put<DeviceKeyStatus>(keyDirectoryPaths.signedPreKey(deviceId), { signedPreKey }),
    listDevices: async (userIds) => listOf<UserDeviceList>(await transport.post<unknown>(keyDirectoryPaths.deviceQuery, { userIds })),
    claimPreKeyBundles: async (devices) => listOf<PreKeyBundle>(await transport.post<unknown>(keyDirectoryPaths.bundleClaim, { devices })),
    removeDevice: (deviceId) => transport.delete(keyDirectoryPaths.device(deviceId)),
  };
}

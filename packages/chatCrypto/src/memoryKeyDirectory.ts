import { decodeBase64 } from "./bytes.util";
import type { DeviceAddress, DeviceKeyStatus, DeviceRegistrationRequest, KeyDirectory, PreKeyBundle, UserDeviceList, WireOneTimePreKey, WireSignedPreKey } from "./directory";
import { verifySignedPreKey } from "./keys";

interface StoredDevice {
  registrationId: number;
  identityKey: string;
  signedPreKey: WireSignedPreKey;
  oneTimePreKeys: WireOneTimePreKey[];
}

export const maximumDevicesPerUser = 5;
export const maximumStoredOneTimePreKeys = 200;

export function isValidSignedPreKey(identityKey: string, signedPreKey: WireSignedPreKey): boolean {
  try {
    return verifySignedPreKey(decodeBase64(identityKey), signedPreKey.keyId, decodeBase64(signedPreKey.publicKey), decodeBase64(signedPreKey.signature));
  } catch {
    return false;
  }
}

export class InMemoryKeyDirectory {
  private readonly devices = new Map<string, Map<string, StoredDevice>>();

  public forUser(userId: string): KeyDirectory {
    return {
      registerDevice: async (deviceId, request) => this.register(userId, deviceId, request),
      fetchDeviceStatus: async (deviceId) => this.status(userId, deviceId),
      uploadOneTimePreKeys: async (deviceId, keys) => {
        const device = this.require(userId, deviceId);
        device.oneTimePreKeys = [...device.oneTimePreKeys, ...keys].slice(-maximumStoredOneTimePreKeys);
        return this.status(userId, deviceId) as DeviceKeyStatus;
      },
      rotateSignedPreKey: async (deviceId, signedPreKey) => {
        const device = this.require(userId, deviceId);
        if (!isValidSignedPreKey(device.identityKey, signedPreKey)) throw new Error("INVALID_SIGNED_PREKEY");
        device.signedPreKey = signedPreKey;
        return this.status(userId, deviceId) as DeviceKeyStatus;
      },
      listDevices: async (userIds) => this.list(userIds),
      claimPreKeyBundles: async (addresses) => this.claim(addresses),
      removeDevice: async (deviceId) => {
        this.devices.get(userId)?.delete(deviceId);
      },
    };
  }

  public register(userId: string, deviceId: string, request: DeviceRegistrationRequest): DeviceKeyStatus {
    if (!isValidSignedPreKey(request.identityKey, request.signedPreKey)) throw new Error("INVALID_SIGNED_PREKEY");
    const userDevices = this.devices.get(userId) ?? new Map<string, StoredDevice>();
    if (!userDevices.has(deviceId) && userDevices.size >= maximumDevicesPerUser) throw new Error("TOO_MANY_DEVICES");
    userDevices.set(deviceId, { registrationId: request.registrationId, identityKey: request.identityKey, signedPreKey: request.signedPreKey, oneTimePreKeys: [...request.oneTimePreKeys].slice(-maximumStoredOneTimePreKeys) });
    this.devices.set(userId, userDevices);
    return this.status(userId, deviceId) as DeviceKeyStatus;
  }

  public status(userId: string, deviceId: string): DeviceKeyStatus | null {
    const device = this.devices.get(userId)?.get(deviceId);
    return device === undefined ? null : { deviceId, identityKey: device.identityKey, signedPreKeyId: device.signedPreKey.keyId, oneTimePreKeyCount: device.oneTimePreKeys.length };
  }

  public list(userIds: readonly string[]): UserDeviceList[] {
    return [...new Set(userIds)].map((userId) => ({
      userId,
      devices: [...(this.devices.get(userId) ?? new Map<string, StoredDevice>()).entries()].map(([deviceId, device]) => ({ deviceId, registrationId: device.registrationId, identityKey: device.identityKey })),
    }));
  }

  public claim(addresses: readonly DeviceAddress[]): PreKeyBundle[] {
    return addresses.flatMap(({ userId, deviceId }) => {
      const device = this.devices.get(userId)?.get(deviceId);
      if (device === undefined) return [];
      const oneTimePreKey = device.oneTimePreKeys.shift() ?? null;
      return [{ userId, deviceId, registrationId: device.registrationId, identityKey: device.identityKey, signedPreKey: device.signedPreKey, oneTimePreKey }];
    });
  }

  private require(userId: string, deviceId: string): StoredDevice {
    const device = this.devices.get(userId)?.get(deviceId);
    if (device === undefined) throw new Error("DEVICE_NOT_FOUND");
    return device;
  }
}

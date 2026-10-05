export interface WireSignedPreKey {
  readonly keyId: number;
  readonly publicKey: string;
  readonly signature: string;
}

export interface WireOneTimePreKey {
  readonly keyId: number;
  readonly publicKey: string;
}

export interface DeviceKeyStatusView {
  readonly deviceId: string;
  readonly identityKey: string;
  readonly signedPreKeyId: number;
  readonly oneTimePreKeyCount: number;
}

export interface UserDevicesView {
  readonly userId: string;
  readonly devices: readonly { readonly deviceId: string; readonly registrationId: number; readonly identityKey: string }[];
}

export interface PreKeyBundleView {
  readonly userId: string;
  readonly deviceId: string;
  readonly registrationId: number;
  readonly identityKey: string;
  readonly signedPreKey: WireSignedPreKey;
  readonly oneTimePreKey: WireOneTimePreKey | null;
}

export interface RegisterDeviceCommand {
  readonly accountId: string;
  readonly deviceId: string;
  readonly registrationId: number;
  readonly identityKey: string;
  readonly signedPreKey: WireSignedPreKey;
  readonly oneTimePreKeys: readonly WireOneTimePreKey[];
}

import { type Bytes, concatBytes, decodeBase64, utf8Encode } from "./bytes.util";
import { sha512Digest } from "./primitives";

export interface TrustRecord {
  readonly devices: Readonly<Record<string, string>>;
  readonly changedAt: string | null;
  readonly acknowledgedAt: string | null;
}

export interface ListedDevice {
  readonly deviceId: string;
  readonly identityKey: string;
}

export interface TrustReconciliation {
  readonly record: TrustRecord;
  readonly changed: boolean;
  readonly replacedDeviceIds: readonly string[];
  readonly removedDeviceIds: readonly string[];
}

export function reconcileTrust(record: TrustRecord | null, listed: readonly ListedDevice[], now: Date): TrustReconciliation {
  const devices = Object.fromEntries(listed.map((device) => [device.deviceId, device.identityKey]));
  if (record === null) return { record: { devices, changedAt: null, acknowledgedAt: null }, changed: false, replacedDeviceIds: [], removedDeviceIds: [] };
  const replacedDeviceIds = listed.filter((device) => record.devices[device.deviceId] !== undefined && record.devices[device.deviceId] !== device.identityKey).map((device) => device.deviceId);
  const addedDeviceIds = listed.filter((device) => record.devices[device.deviceId] === undefined).map((device) => device.deviceId);
  const removedDeviceIds = Object.keys(record.devices).filter((deviceId) => devices[deviceId] === undefined);
  const changed = replacedDeviceIds.length > 0 || addedDeviceIds.length > 0;
  return {
    record: { devices, changedAt: changed ? now.toISOString() : record.changedAt, acknowledgedAt: record.acknowledgedAt },
    changed, replacedDeviceIds, removedDeviceIds,
  };
}

export const hasUnacknowledgedChange = (record: TrustRecord | null): boolean =>
  record !== null && record.changedAt !== null && (record.acknowledgedAt === null || record.acknowledgedAt < record.changedAt);

function fingerprintDigits(userId: string, identityKeys: readonly string[]): string {
  const sortedKeys = [...identityKeys].sort().map((key) => decodeBase64(key));
  let digest: Bytes = concatBytes(new Uint8Array([0, 1]), utf8Encode(userId), ...sortedKeys);
  for (let round = 0; round < 1024; round++) digest = sha512Digest(concatBytes(digest, ...sortedKeys));
  let digits = "";
  for (let chunk = 0; chunk < 6; chunk++) {
    const offset = chunk * 5;
    const value = [0, 1, 2, 3, 4].reduce((total, index) => total * 256 + (digest[offset + index] as number), 0);
    digits += String(value % 100_000).padStart(5, "0");
  }
  return digits;
}

export function computeSecurityCode(first: { readonly userId: string; readonly identityKeys: readonly string[] }, second: { readonly userId: string; readonly identityKeys: readonly string[] }): string {
  const parts = [fingerprintDigits(first.userId, first.identityKeys), fingerprintDigits(second.userId, second.identityKeys)];
  const ordered = first.userId < second.userId ? parts : [...parts].reverse();
  return (ordered.join("").match(/.{5}/g) ?? []).join(" ");
}

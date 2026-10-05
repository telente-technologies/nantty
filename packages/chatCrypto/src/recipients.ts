import type { DeviceAddress, DirectoryDevice, KeyDirectory } from "./directory";
import { reconcileTrust } from "./identityTrust";
import type { ProtocolStore } from "./protocolStore";
import type { SessionCipher } from "./sessionCipher";

export interface ResolvedDevice extends DeviceAddress {
  readonly identityKey: string;
}

const deviceListTtlMilliseconds = 30_000;

export class RecipientResolver {
  private readonly cache = new Map<string, { readonly fetchedAt: number; readonly devices: readonly DirectoryDevice[] }>();

  public constructor(private readonly store: ProtocolStore, private readonly directory: KeyDirectory, private readonly now: () => Date) {}

  public async resolve(userIds: readonly string[], options: { readonly fresh?: boolean } = {}): Promise<ResolvedDevice[]> {
    const nowMs = this.now().getTime();
    const stale = [...new Set(userIds)].filter((userId) => options.fresh || (this.cache.get(userId)?.fetchedAt ?? 0) + deviceListTtlMilliseconds < nowMs);
    if (stale.length > 0) {
      const lists = await this.directory.listDevices(stale);
      for (const userId of stale) {
        const devices = lists.find((list) => list.userId === userId)?.devices ?? [];
        await this.applyTrust(userId, devices);
        this.cache.set(userId, { fetchedAt: nowMs, devices });
      }
    }
    return [...new Set(userIds)].flatMap((userId) => (this.cache.get(userId)?.devices ?? []).map((device) => ({ userId, deviceId: device.deviceId, identityKey: device.identityKey })));
  }

  private async applyTrust(userId: string, devices: readonly DirectoryDevice[]) {
    const reconciliation = reconcileTrust(await this.store.loadTrust(userId), devices, this.now());
    for (const deviceId of [...reconciliation.replacedDeviceIds, ...reconciliation.removedDeviceIds]) await this.store.deleteSession(userId, deviceId);
    await this.store.saveTrust(userId, reconciliation.record);
  }

  public forget(userId: string): void {
    this.cache.delete(userId);
  }

  public async ensureSessions(cipher: SessionCipher, devices: readonly ResolvedDevice[]): Promise<ResolvedDevice[]> {
    const missing: ResolvedDevice[] = [];
    for (const device of devices) if (!(await cipher.hasSession(device.userId, device.deviceId))) missing.push(device);
    if (missing.length > 0) {
      const bundles = await this.directory.claimPreKeyBundles(missing.map(({ userId, deviceId }) => ({ userId, deviceId })));
      for (const bundle of bundles) {
        const expected = missing.find((device) => device.userId === bundle.userId && device.deviceId === bundle.deviceId);
        if (expected === undefined || expected.identityKey !== bundle.identityKey) continue;
        try {
          await cipher.initiateFromBundle(bundle);
        } catch {
          continue;
        }
      }
    }
    const ready: ResolvedDevice[] = [];
    for (const device of devices) if (await cipher.hasSession(device.userId, device.deviceId)) ready.push(device);
    return ready;
  }
}

import { readKeyValueFromOfflineStore, writeKeyValueToOfflineStore } from "@/utils/posOfflineDatabase.util";

export interface PosDeviceMemory {
  readonly locationId: string | null;
  readonly registerIdByLocationId: Readonly<Record<string, string>>;
}

const emptyPosDeviceMemory: PosDeviceMemory = { locationId: null, registerIdByLocationId: {} };

function buildPosDeviceMemoryKey(storeId: string): string {
  return `posDevice:${storeId}`;
}

export async function readPosDeviceMemoryForStore(storeId: string): Promise<PosDeviceMemory> {
  return (await readKeyValueFromOfflineStore<PosDeviceMemory>(buildPosDeviceMemoryKey(storeId))) ?? emptyPosDeviceMemory;
}

async function updatePosDeviceMemoryForStore(storeId: string, update: (current: PosDeviceMemory) => PosDeviceMemory): Promise<PosDeviceMemory> {
  const updatedMemory = update(await readPosDeviceMemoryForStore(storeId));
  await writeKeyValueToOfflineStore(buildPosDeviceMemoryKey(storeId), updatedMemory);
  return updatedMemory;
}

export function rememberPosDeviceLocation(storeId: string, locationId: string): Promise<PosDeviceMemory> {
  return updatePosDeviceMemoryForStore(storeId, (current) => ({ ...current, locationId }));
}

export function rememberPosDeviceRegister(storeId: string, locationId: string, registerId: string): Promise<PosDeviceMemory> {
  return updatePosDeviceMemoryForStore(storeId, (current) => ({ locationId, registerIdByLocationId: { ...current.registerIdByLocationId, [locationId]: registerId } }));
}

interface StoredOfflineOperatorPass {
  readonly staffId: string;
  readonly pass: string;
}

function buildOfflineOperatorPassKey(storeId: string): string {
  return `posOperatorPass:${storeId}`;
}

export async function rememberOfflineOperatorPass(storeId: string, staffId: string, pass: string): Promise<void> {
  await writeKeyValueToOfflineStore(buildOfflineOperatorPassKey(storeId), { staffId, pass } satisfies StoredOfflineOperatorPass);
}

export async function forgetOfflineOperatorPass(storeId: string): Promise<void> {
  await writeKeyValueToOfflineStore(buildOfflineOperatorPassKey(storeId), null);
}

export async function readOfflineOperatorPassForStaff(storeId: string, staffId: string): Promise<string | null> {
  const storedPass = await readKeyValueFromOfflineStore<StoredOfflineOperatorPass>(buildOfflineOperatorPassKey(storeId));
  return storedPass?.staffId === staffId ? storedPass.pass : null;
}

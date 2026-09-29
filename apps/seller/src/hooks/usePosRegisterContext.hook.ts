"use client";

import { createContext, useContext } from "react";

import type { PosSale } from "@/types/pos.type";
import type { PosCatalogSnapshot, QueuedOfflineSale } from "@/types/posExtra.type";
import type { PosRegister } from "@/types/store.type";

export interface PosRegisterContextValue {
  readonly locationId: string | null;
  readonly registers: PosRegister[];
  readonly selectedRegister: PosRegister | null;
  readonly selectRegister: (registerId: string) => void;
  readonly rememberRegisterShift: (registerId: string, shiftId: string | null) => void;
  readonly reloadRegisters: () => void;
  readonly catalog: PosCatalogSnapshot | null;
  readonly isCatalogFromCache: boolean;
  readonly isCatalogLoading: boolean;
  readonly reloadCatalog: () => void;
  readonly applySaleToLocalStock: (sale: PosSale) => Promise<void>;
  readonly isOnline: boolean;
  readonly reportRequestOutcome: (wasOffline: boolean) => void;
  readonly queuedSales: QueuedOfflineSale[];
  readonly refreshQueuedSales: () => Promise<void>;
  readonly syncQueuedSalesNow: () => Promise<void>;
  readonly isSyncing: boolean;
  readonly isLocked: boolean;
  readonly lockRegister: () => Promise<void>;
  readonly markRegisterUnlocked: () => void;
}

export const PosRegisterContext = createContext<PosRegisterContextValue | null>(null);

export function usePosRegisterContext(): PosRegisterContextValue {
  const contextValue = useContext(PosRegisterContext);
  if (!contextValue) throw new Error("usePosRegisterContext must be used inside PosRegisterProvider.");
  return contextValue;
}

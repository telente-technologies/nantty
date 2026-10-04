import { create } from "zustand";

type VerificationOutcome = (passed: boolean) => void;

interface HumanVerificationState {
  readonly isOpen: boolean;
  readonly reason: string;
  readonly waiting: readonly VerificationOutcome[];
  readonly requestHumanVerification: (reason: string) => Promise<boolean>;
  readonly finishHumanVerification: (passed: boolean) => void;
}

export const useHumanVerificationStore = create<HumanVerificationState>((set, get) => ({
  isOpen: false,
  reason: "",
  waiting: [],
  requestHumanVerification: (reason) => new Promise<boolean>((resolve) => set({ isOpen: true, reason, waiting: [...get().waiting, resolve] })),
  finishHumanVerification: (passed) => {
    const waiting = get().waiting;
    set({ isOpen: false, reason: "", waiting: [] });
    waiting.forEach((resolve) => resolve(passed));
  },
}));

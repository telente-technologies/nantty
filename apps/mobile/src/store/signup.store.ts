import { create } from "zustand";

interface SignUpDraft {
  readonly channel: "phone" | "email";
  readonly destination: string;
  readonly otpToken: string | null;
  readonly birthday: string;
  readonly password: string;
  readonly update: (patch: Partial<Omit<SignUpDraft, "update" | "reset">>) => void;
  readonly reset: () => void;
}

const empty = { channel: "phone" as const, destination: "", otpToken: null, birthday: "", password: "" };

export const useSignUpStore = create<SignUpDraft>((set) => ({
  ...empty,
  update: (patch) => set(patch),
  reset: () => set(empty),
}));

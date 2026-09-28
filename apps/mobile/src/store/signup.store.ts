import { create } from "zustand";

import type { AuthSession } from "@/types";

export type SignUpContactChannel = "phone" | "email";

interface SignUpDraftValues {
  readonly channel: SignUpContactChannel;
  readonly destination: string;
  readonly otpToken: string | null;
  readonly birthday: string;
  readonly password: string;
  readonly username: string;
  readonly saveLoginInfo: boolean;
  readonly pendingSession: AuthSession | null;
}

interface SignUpDraft extends SignUpDraftValues {
  readonly updateSignUpDraft: (patch: Partial<SignUpDraftValues>) => void;
  readonly clearSignUpDraft: () => void;
}

const emptySignUpDraft: SignUpDraftValues = {
  channel: "phone",
  destination: "",
  otpToken: null,
  birthday: "",
  password: "",
  username: "",
  saveLoginInfo: true,
  pendingSession: null,
};

export const useSignUpStore = create<SignUpDraft>((set) => ({
  ...emptySignUpDraft,
  updateSignUpDraft: (patch) => set(patch),
  clearSignUpDraft: () => set(emptySignUpDraft),
}));

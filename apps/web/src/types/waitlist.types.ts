export type WaitlistRole = "buyer" | "seller";

export interface WaitlistSignupRequest {
  readonly email: string;
  readonly role?: WaitlistRole;
  readonly source?: string;
}

export type WaitlistSignupResult =
  | { readonly outcome: "joined"; readonly message: string }
  | { readonly outcome: "failed"; readonly message: string };

export type WaitlistFormStatus = "idle" | "submitting" | "joined" | "failed";

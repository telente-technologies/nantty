export type SocialSignInProvider = "apple" | "google";

const providerDisplayName = (provider: SocialSignInProvider) => (provider === "apple" ? "Apple" : "Google");

export class SocialSignInNotConfiguredError extends Error {
  constructor(provider: SocialSignInProvider) {
    super(`${providerDisplayName(provider)} sign-in isn't configured yet.`);
    this.name = "SocialSignInNotConfiguredError";
  }
}

export class SocialSignInCancelledError extends Error {
  constructor(provider: SocialSignInProvider) {
    super(`${providerDisplayName(provider)} sign-in was cancelled.`);
    this.name = "SocialSignInCancelledError";
  }
}

export class SocialSignInFailedError extends Error {
  constructor(provider: SocialSignInProvider, reason: string) {
    super(`${providerDisplayName(provider)} sign-in failed: ${reason}`);
    this.name = "SocialSignInFailedError";
  }
}

export type ChatCryptoErrorCode =
  | "DUPLICATE_MESSAGE"
  | "NO_SESSION"
  | "INVALID_MESSAGE"
  | "INVALID_SIGNATURE"
  | "UNTRUSTED_IDENTITY"
  | "PREKEY_NOT_FOUND"
  | "TOO_MANY_SKIPPED"
  | "NO_SENDER_KEY"
  | "NOT_FOR_THIS_DEVICE"
  | "NO_RECIPIENT_DEVICES"
  | "ENVELOPE_TOO_LARGE"
  | "PAYLOAD_MISMATCH"
  | "NOT_REGISTERED";

export class ChatCryptoError extends Error {
  public constructor(public readonly code: ChatCryptoErrorCode, message: string) {
    super(message);
    this.name = "ChatCryptoError";
  }
}

export const isChatCryptoError = (error: unknown, code?: ChatCryptoErrorCode): error is ChatCryptoError =>
  error instanceof ChatCryptoError && (code === undefined || error.code === code);

import type { DecryptionFailure } from "./chatCryptoClient";

export function describeDecryptionFailure(reason: DecryptionFailure): string {
  switch (reason) {
    case "NOT_FOR_THIS_DEVICE":
      return "Sent before this device joined secure chat.";
    case "SENT_FROM_THIS_DEVICE":
      return "You sent this message. Its text isn't stored on this device.";
    case "NO_SENDER_KEY":
    case "NO_SESSION":
    case "PREKEY_NOT_FOUND":
      return "Waiting for this message. Ask the sender to send it again.";
    case "UNTRUSTED_IDENTITY":
      return "This message couldn't be verified because the sender's security code changed.";
    case "DUPLICATE_MESSAGE":
      return "This message was already received.";
    default:
      return "This message couldn't be decrypted.";
  }
}

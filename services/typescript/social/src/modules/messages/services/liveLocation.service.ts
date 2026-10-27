import { gone } from "../../../errors/social.error.js";

export type LegacyChatFeature = "reactions" | "pollVotes" | "liveLocation";

const copy: Record<LegacyChatFeature, string> = {
  reactions: "Reactions are now end-to-end encrypted. Update Nantty to react to messages.",
  pollVotes: "Poll votes are now end-to-end encrypted. Update Nantty to vote.",
  liveLocation: "Live locations are now end-to-end encrypted. Update Nantty to share your location.",
};

export function rejectLegacyPlaintextEndpoint(feature: LegacyChatFeature): never {
  throw gone("ENCRYPTED_CLIENT_REQUIRED", copy[feature]);
}

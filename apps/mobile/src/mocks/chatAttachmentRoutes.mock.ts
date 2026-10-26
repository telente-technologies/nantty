import { ApiError } from "@/errors/api.error";

import { createMockRoute, type MockRoute } from "./registry.mock";

const gone = (message: string) => () => {
  throw new ApiError(410, message, "ENCRYPTED_CLIENT_REQUIRED");
};

export const chatAttachmentMocks: MockRoute[] = [
  createMockRoute("PATCH", "/api/v1/messages/:messageId/location", gone("Live locations are now end-to-end encrypted. Update Nantty to share your location.")),
  createMockRoute("POST", "/api/v1/messages/:messageId/live-location/stop", gone("Live locations are now end-to-end encrypted. Update Nantty to share your location.")),
  createMockRoute("POST", "/api/v1/messages/:messageId/poll-votes", gone("Poll votes are now end-to-end encrypted. Update Nantty to vote.")),
  createMockRoute("POST", "/api/v1/messages/:messageId/reactions", gone("Reactions are now end-to-end encrypted. Update Nantty to react to messages.")),
  createMockRoute("DELETE", "/api/v1/messages/:messageId/reactions/:emoji", gone("Reactions are now end-to-end encrypted. Update Nantty to react to messages.")),
];

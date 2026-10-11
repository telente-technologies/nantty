import { api } from "../core/apiClient.service";

export interface LiveMediaGrant {
  readonly url: string;
  readonly token: string;
  readonly canPublish: boolean;
  readonly role: "host" | "guest" | "viewer";
}

export const liveMediaService = {
  issueMediaToken: (liveId: string) => api.post<LiveMediaGrant>(`/api/v1/lives/${liveId}/media-token`),
};

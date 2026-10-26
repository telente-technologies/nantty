import { createRealtimeHub } from "@nantty/web-kit/src/realtime/realtimeHub";
import { createRealtimeTicketFetcher } from "@nantty/web-kit/src/realtime/realtimeTicket";

import { readCsrfTokenForRequests } from "@/services/clientApi.service";

export const studioRealtime = createRealtimeHub({
  fetchTicket: createRealtimeTicketFetcher({ endpoint: "/bff/realtime", readCsrfToken: readCsrfTokenForRequests }),
});

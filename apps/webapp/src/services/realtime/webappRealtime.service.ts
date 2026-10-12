import { createRealtimeHub } from "@zudomart/web-kit/src/realtime/realtimeHub";
import { createRealtimeTicketFetcher } from "@zudomart/web-kit/src/realtime/realtimeTicket";

import { readCsrfTokenForRequests } from "@/services/clientApi.service";

export const webappRealtime = createRealtimeHub({
  fetchTicket: createRealtimeTicketFetcher({ endpoint: "/bff/realtime", readCsrfToken: readCsrfTokenForRequests }),
});

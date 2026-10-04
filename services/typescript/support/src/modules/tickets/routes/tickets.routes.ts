import type { HttpRouter } from "@zudojs/http";

import type { createMacrosController } from "../controllers/macros.controller.js";
import type { createMyTicketsController } from "../controllers/myTickets.controller.js";
import type { createStaffChatsController } from "../controllers/staffChats.controller.js";
import type { createStaffTicketsController } from "../controllers/staffTickets.controller.js";

export interface TicketControllers {
  readonly mine: ReturnType<typeof createMyTicketsController>;
  readonly staff: ReturnType<typeof createStaffTicketsController>;
  readonly chats: ReturnType<typeof createStaffChatsController>;
  readonly macros: ReturnType<typeof createMacrosController>;
}

export function registerTicketRoutes(router: HttpRouter, controllers: TicketControllers): void {
  const { mine, staff, chats, macros } = controllers;
  router.get("/api/v1/support/tickets", mine.list);
  router.post("/api/v1/support/tickets", mine.create);
  router.get("/api/v1/support/tickets/unread-count", mine.unreadCount);
  router.get("/api/v1/support/tickets/:ticketId", mine.detail);
  router.post("/api/v1/support/tickets/:ticketId/messages", mine.reply);
  router.post("/api/v1/support/tickets/:ticketId/read", mine.markRead);
  router.post("/api/v1/support/tickets/:ticketId/rating", mine.rate);
  router.get("/api/v1/admin/support/tickets", staff.queue);
  router.get("/api/v1/admin/support/tickets/:ticketId", staff.detail);
  router.post("/api/v1/admin/support/tickets/:ticketId/replies", staff.reply);
  router.post("/api/v1/admin/support/tickets/:ticketId/status", staff.status);
  router.post("/api/v1/admin/support/tickets/:ticketId/assign", staff.assign);
  router.get("/api/v1/admin/support/agents", staff.agents);
  router.get("/api/v1/admin/support/chats", chats.list);
  router.get("/api/v1/admin/support/chats/:chatId", chats.detail);
  router.post("/api/v1/admin/support/chats/:chatId/claim", chats.claim);
  router.post("/api/v1/admin/support/chats/:chatId/messages", chats.message);
  router.post("/api/v1/admin/support/chats/:chatId/end", chats.end);
  router.get("/api/v1/admin/support/macros", macros.list);
  router.post("/api/v1/admin/support/macros", macros.create);
  router.put("/api/v1/admin/support/macros/:macroId", macros.update);
  router.delete("/api/v1/admin/support/macros/:macroId", macros.remove);
}

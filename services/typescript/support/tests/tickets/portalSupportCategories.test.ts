import { describe, expect, it } from "vitest";

import { defaultPriorityByCategory } from "../../src/constants/ticketSla.constant.js";
import { ticketCategories } from "../../src/enums/ticket.enum.js";
import { createTicketBodySchema, macroBodySchema, staffQueueQuerySchema } from "../../src/modules/tickets/validators/ticket.validator.js";

describe("Developer and Sandbox support categories", () => {
  it("accepts both categories when customers create tickets", () => {
    for (const category of ["developer", "sandbox"] as const) {
      expect(ticketCategories).toContain(category);
      expect(createTicketBodySchema.parse({ category, subject: "Portal request failed", message: "The request failed with a redacted response and request ID." }).category).toBe(category);
      expect(defaultPriorityByCategory[category]).toBeDefined();
    }
  });

  it("allows Admin queue filters and reply macros to use the same categories", () => {
    for (const category of ["DEVELOPER", "SANDBOX"] as const) {
      expect(staffQueueQuerySchema.parse({ category }).category).toBe(category);
      expect(macroBodySchema.parse({ title: "Portal triage", body: "Share the environment, endpoint, request ID, and redacted error. Never include credentials.", category }).category).toBe(category);
    }
  });

  it("still rejects unknown categories instead of silently routing them", () => {
    expect(() => createTicketBodySchema.parse({ category: "integration", subject: "Portal request failed", message: "The request failed with a redacted response and request ID." })).toThrow();
  });
});

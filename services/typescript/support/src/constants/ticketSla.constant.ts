import type { TicketCategory, TicketPriority } from "../enums/ticket.enum.js";

export const firstResponseMinutesByPriority: Readonly<Record<TicketPriority, number>> = { urgent: 60, high: 240, normal: 480, low: 1440 };
export const resolutionMinutesByPriority: Readonly<Record<TicketPriority, number>> = { urgent: 480, high: 1440, normal: 2880, low: 4320 };

export const defaultPriorityByCategory: Readonly<Record<TicketCategory, TicketPriority>> = {
  order: "normal",
  payment: "high",
  account: "normal",
  seller: "normal",
  verification: "normal",
  creator: "normal",
  live: "normal",
  ads: "low",
  safety: "high",
  other: "low",
};

export const priorityRank: Readonly<Record<TicketPriority, number>> = { urgent: 0, high: 1, normal: 2, low: 3 };

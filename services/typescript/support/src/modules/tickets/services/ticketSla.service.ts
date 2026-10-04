import { firstResponseMinutesByPriority, resolutionMinutesByPriority } from "../../../constants/ticketSla.constant.js";
import { isTicketStatusStopped, type TicketPriority } from "../../../enums/ticket.enum.js";
import type { TicketRecord } from "../../../types/ticket.type.js";

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

export function calculateSlaDueDates(priority: TicketPriority, openedAt: Date): { readonly firstResponseDueAt: Date; readonly resolutionDueAt: Date } {
  return { firstResponseDueAt: addMinutes(openedAt, firstResponseMinutesByPriority[priority]), resolutionDueAt: addMinutes(openedAt, resolutionMinutesByPriority[priority]) };
}

export function isTicketBreachingSla(ticket: TicketRecord, now: Date): boolean {
  if (isTicketStatusStopped(ticket.status)) return false;
  return (ticket.firstRespondedAt === null && now > ticket.firstResponseDueAt) || now > ticket.resolutionDueAt;
}

export function firstResponseHours(priority: TicketPriority): number {
  return Math.max(1, Math.round(firstResponseMinutesByPriority[priority] / 60));
}

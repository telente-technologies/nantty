import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { TicketCategory } from "../../../enums/ticket.enum.js";
import type { TicketStore } from "../../../interfaces/ticketStore.interface.js";
import type { MacroRecord } from "../../../types/ticket.type.js";

type AuxiliaryStore = Pick<TicketStore, "listMacros" | "createMacro" | "updateMacro" | "deleteMacro" | "recordAgentSeen" | "listAgentsSeenSince" | "hasProcessedEvent" | "markEventProcessed">;

const mapMacro = (row: { id: string; title: string; body: string; category: string | null; updatedAt: Date; updatedByName: string }): MacroRecord => ({
  id: row.id, title: row.title, body: row.body, category: row.category as TicketCategory | null, updatedAt: row.updatedAt, updatedByName: row.updatedByName,
});

export function createSupportAuxiliaryRepository(prisma: PrismaClient): AuxiliaryStore {
  return {
    listMacros: async () => (await prisma.supportMacro.findMany({ orderBy: { title: "asc" } })).map(mapMacro),
    createMacro: async (input) => mapMacro(await prisma.supportMacro.create({ data: { id: randomUUID(), ...input } })),
    async updateMacro(macroId, input) {
      const updated = await prisma.supportMacro.updateMany({ where: { id: macroId }, data: input });
      if (updated.count === 0) return null;
      const row = await prisma.supportMacro.findUnique({ where: { id: macroId } });
      return row === null ? null : mapMacro(row);
    },
    deleteMacro: async (macroId) => (await prisma.supportMacro.deleteMany({ where: { id: macroId } })).count === 1,
    async recordAgentSeen(agent, now) {
      await prisma.supportAgent.upsert({ where: { staffId: agent.staffId }, create: { staffId: agent.staffId, name: agent.name, lastSeenAt: now }, update: { name: agent.name, lastSeenAt: now } });
    },
    listAgentsSeenSince: async (since) => (await prisma.supportAgent.findMany({ where: { lastSeenAt: { gte: since }, canAnswer: true }, orderBy: { name: "asc" } })).map((row) => ({ staffId: row.staffId, name: row.name })),
    hasProcessedEvent: async (eventId) => (await prisma.processedEvent.findUnique({ where: { eventId }, select: { eventId: true } })) !== null,
    async markEventProcessed(eventId, eventType) {
      await prisma.processedEvent.upsert({ where: { eventId }, create: { eventId, eventType }, update: {} });
    },
  };
}

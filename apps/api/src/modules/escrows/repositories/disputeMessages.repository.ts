import { randomUUID } from "node:crypto";

import type { DisputeMessage } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { DisputeMessageRecord, DisputeParticipantRole, NewDisputeMessage } from "../models/escrows.model.js";

export interface DisputeMessagesRepository {
  create(input: NewDisputeMessage): Promise<DisputeMessageRecord>;
  listForDispute(disputeId: string): Promise<readonly DisputeMessageRecord[]>;
}

export class InMemoryDisputeMessagesRepository implements DisputeMessagesRepository {
  private readonly messages: DisputeMessageRecord[] = [];

  public async create(input: NewDisputeMessage): Promise<DisputeMessageRecord> {
    const message: DisputeMessageRecord = { ...input, id: randomUUID() };
    this.messages.push(message);
    return message;
  }

  public async listForDispute(disputeId: string): Promise<readonly DisputeMessageRecord[]> {
    return this.messages.filter((message) => message.disputeId === disputeId);
  }
}

function convertDisputeMessageRowToRecord(row: DisputeMessage): DisputeMessageRecord {
  return { ...row, authorRole: row.authorRole as DisputeParticipantRole };
}

export class PrismaDisputeMessagesRepository implements DisputeMessagesRepository {
  public async create(input: NewDisputeMessage): Promise<DisputeMessageRecord> {
    return convertDisputeMessageRowToRecord(await prisma().disputeMessage.create({ data: { ...input, attachmentMediaIds: [...input.attachmentMediaIds] } }));
  }

  public async listForDispute(disputeId: string): Promise<readonly DisputeMessageRecord[]> {
    const rows = await prisma().disputeMessage.findMany({ where: { disputeId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(convertDisputeMessageRowToRecord);
  }
}

import { ApiError } from "@/errors/api.error";
import type { Dispute, DisputeMessage, DisputeParticipantRole, DisputeStatusEvent, OpenDisputeInput } from "@/types/commerce.type";

import { buildOrderFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { SIGNED_IN_BUYER, findOrderRecord, type MockOrderRecord } from "./orderFixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";
import { findDirectoryUserById } from "./userDirectory.mock";

type Writable<T> = { -readonly [K in keyof T]: T[K] };

type MockDisputeRecord = Writable<Omit<Dispute, "orderReference" | "productName" | "amount" | "viewerRole" | "counterpartyName" | "messages">> & {
  messages: Array<Omit<DisputeMessage, "authorName" | "authorAvatarUrl">>;
};

const SELLER_RESPONSE_WINDOW_HOURS = 48;

const disputeRecords: MockDisputeRecord[] = [
  {
    id: "d_901", orderId: "o_4104", reason: "not_as_described", status: "under_review",
    description: "The sneakers have a visible glue stain on the left toe and the sole is already peeling at the heel. The photos on the listing looked perfect.",
    evidenceUrls: [], openedAt: isoDateHoursAgo(110), respondByAt: null, resolutionNote: null,
    statusHistory: [
      { status: "open", label: "Dispute opened — escrow release paused", occurredAt: isoDateHoursAgo(110) },
      { status: "awaiting_seller", label: "Waiting for Kicks by Emeka to respond", occurredAt: isoDateHoursAgo(109) },
      { status: "under_review", label: "Nantty support is reviewing", occurredAt: isoDateHoursAgo(70) },
    ],
    messages: [
      { id: "dm_1", authorRole: "buyer", text: "Hi, the sneakers arrived with a glue stain and the heel is peeling. I've added photos.", attachmentUrls: [], createdAt: isoDateHoursAgo(110) },
      { id: "dm_2", authorRole: "seller", text: "So sorry about this! It must have happened during finishing. I can send a replacement pair or refund — whichever you prefer.", attachmentUrls: [], createdAt: isoDateHoursAgo(90) },
      { id: "dm_3", authorRole: "support", text: "Thanks both. We've reviewed the photos. Would you like a replacement or a full refund? Your payment stays safely in escrow until this is settled.", attachmentUrls: [], createdAt: isoDateHoursAgo(70) },
    ],
  },
  {
    id: "d_902", orderId: "o_5204", reason: "damaged", status: "awaiting_seller",
    description: "The candle jar arrived cracked and wax had leaked into the box.",
    evidenceUrls: [], openedAt: isoDateHoursAgo(20), respondByAt: isoDateHoursAgo(20 - SELLER_RESPONSE_WINDOW_HOURS), resolutionNote: null,
    statusHistory: [
      { status: "open", label: "Dispute opened — escrow release paused", occurredAt: isoDateHoursAgo(20) },
      { status: "awaiting_seller", label: "Waiting for the seller to respond", occurredAt: isoDateHoursAgo(19.5) },
    ],
    messages: [
      { id: "dm_4", authorRole: "buyer", text: "Hello, the hibiscus candle arrived cracked. Photos attached. Can you send another one?", attachmentUrls: [], createdAt: isoDateHoursAgo(20) },
    ],
  },
];

const viewerRoleFor = (order: MockOrderRecord): "buyer" | "seller" => (order.buyerUserId === SIGNED_IN_BUYER ? "buyer" : "seller");

const participantIdentity = (role: DisputeParticipantRole, order: MockOrderRecord) => {
  if (role === "support") return findDirectoryUserById("u_25")!;
  if (role === "buyer") return order.buyerUserId === SIGNED_IN_BUYER ? getSignedInMockUser() : findDirectoryUserById(order.buyerUserId)!;
  return findDirectoryUserById(findDirectoryStoreById(order.storeId).ownerUserKey)!;
};

function presentDispute(record: MockDisputeRecord): Dispute {
  const order = findOrderRecord(record.orderId)!;
  const presentedOrder = buildOrderFromRecord(order);
  const viewerRole = viewerRoleFor(order);
  return {
    ...record,
    orderReference: order.reference,
    productName: presentedOrder.items[0]?.product.name ?? order.reference,
    amount: presentedOrder.total,
    viewerRole,
    counterpartyName: viewerRole === "buyer" ? presentedOrder.store.name : presentedOrder.buyer.name,
    messages: record.messages.map((message) => {
      const author = participantIdentity(message.authorRole, order);
      return { ...message, authorName: author.name, authorAvatarUrl: author.avatarUrl };
    }),
  };
}

const signedInUserTakesPartIn = (record: MockDisputeRecord) => {
  const order = findOrderRecord(record.orderId);
  if (!order) return false;
  return order.buyerUserId === SIGNED_IN_BUYER || findDirectoryStoreById(order.storeId).id === getSignedInMockUser().storeId;
};

const findDisputeOrThrow = (disputeId: string) => {
  const record = disputeRecords.find((candidate) => candidate.id === disputeId);
  if (!record || !signedInUserTakesPartIn(record)) throw new ApiError(404, "Dispute not found");
  return record;
};

const statusEvent = (status: DisputeStatusEvent["status"], label: string): DisputeStatusEvent => ({ status, label, occurredAt: new Date().toISOString() });

export const disputesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/disputes", () => disputeRecords.filter(signedInUserTakesPartIn).map(presentDispute)),
  createMockRoute("GET", "/api/v1/disputes/:disputeId", ({ params }) => presentDispute(findDisputeOrThrow(params.disputeId!))),
  createMockRoute("POST", "/api/v1/orders/:orderId/disputes", ({ params, body }) => {
    const order = findOrderRecord(params.orderId!);
    if (!order || order.buyerUserId !== SIGNED_IN_BUYER) throw new ApiError(404, "Order not found");
    const existing = disputeRecords.find((record) => record.orderId === order.id);
    if (existing) return presentDispute(existing);
    if (!["paid", "shipped", "delivered"].includes(order.status)) throw new ApiError(409, "This order can no longer be disputed");
    const input = body as OpenDisputeInput;
    const record: MockDisputeRecord = {
      id: `d_${Date.now()}`,
      orderId: order.id,
      reason: input.reason,
      description: input.description,
      evidenceUrls: input.evidenceUrls,
      status: "awaiting_seller",
      openedAt: new Date().toISOString(),
      respondByAt: new Date(Date.now() + SELLER_RESPONSE_WINDOW_HOURS * 3_600_000).toISOString(),
      resolutionNote: null,
      statusHistory: [statusEvent("open", "Dispute opened — escrow release paused"), statusEvent("awaiting_seller", "Waiting for the seller to respond")],
      messages: [{ id: `dm_${Date.now()}`, authorRole: "buyer", text: input.description, attachmentUrls: input.evidenceUrls, createdAt: new Date().toISOString() }],
    };
    disputeRecords.unshift(record);
    order.status = "disputed";
    order.disputeId = record.id;
    return presentDispute(record);
  }),
  createMockRoute("POST", "/api/v1/disputes/:disputeId/messages", ({ params, body }) => {
    const record = findDisputeOrThrow(params.disputeId!);
    const order = findOrderRecord(record.orderId)!;
    const { text, attachmentUrls = [] } = body as { text: string; attachmentUrls?: string[] };
    const message = { id: `dm_${Date.now()}`, authorRole: viewerRoleFor(order), text, attachmentUrls, createdAt: new Date().toISOString() } as const;
    record.messages.push(message);
    if (message.authorRole === "seller" && record.status === "awaiting_seller") {
      record.status = "under_review";
      record.statusHistory = [...record.statusHistory, statusEvent("under_review", "Seller responded — Nantty support is reviewing")];
    }
    return presentDispute(record).messages.at(-1);
  }),
];


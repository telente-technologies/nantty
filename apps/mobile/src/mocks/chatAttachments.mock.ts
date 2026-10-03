import type { Message, MessagePoll } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";

export interface PollInput {
  readonly question: string;
  readonly allowMultipleAnswers: boolean;
  readonly options: readonly string[];
}

const SAMPLE_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const DOCUMENT_RETENTION_MS = 30 * 86_400_000;

export const buildPollFromInput = (input: PollInput): MessagePoll => ({
  question: input.question,
  allowMultipleAnswers: input.allowMultipleAnswers,
  options: input.options.map((text, index) => ({ id: `opt_${Date.now().toString(36)}_${index}`, text, voteCount: 0, votedByMe: false })),
});

export const buildMessagePreviewText = (message: Message) => {
  if (message.kind === "voice") return "🎤 Voice note";
  if (message.kind === "location") return "📍 Location";
  if (message.kind === "liveLocation") return "📍 Live location";
  if (message.kind === "document") return `📄 ${message.document?.fileName ?? "Document"}`;
  if (message.kind === "poll") return `📊 ${message.poll?.question ?? "Poll"}`;
  if (message.kind === "shared") return message.text || "Shared content";
  return message.text;
};

type TextMessageBuilder = (id: string, conversationId: string, senderId: string, text: string, hoursAgo: number) => Message;

export const buildAttachmentSeedMessages = (conversationId: string, peerId: string, buildText: TextMessageBuilder): Message[] => [
  {
    ...buildText("m_loc_peer", conversationId, peerId, "", 3.5),
    kind: "location",
    location: { latitude: 6.4281, longitude: 3.4219, address: "Adeola Odeku Street, Victoria Island, Lagos", updatedAt: isoDateHoursAgo(3.5) },
  },
  {
    ...buildText("m_live_peer", conversationId, peerId, "", 0.2),
    kind: "liveLocation",
    location: {
      latitude: 6.5244,
      longitude: 3.3792,
      address: "Herbert Macaulay Way, Yaba, Lagos",
      liveUntil: new Date(Date.now() + 45 * 60_000).toISOString(),
      updatedAt: isoDateHoursAgo(0.01),
    },
  },
  {
    ...buildText("m_doc_peer", conversationId, peerId, "", 3.2),
    kind: "document",
    document: { fileName: "Aso-ebi order form.pdf", mimeType: "application/pdf", sizeBytes: 13264, pageCount: 1, url: SAMPLE_PDF_URL },
    mediaExpiresAt: new Date(Date.now() + DOCUMENT_RETENTION_MS).toISOString(),
  },
  {
    ...buildText("m_doc_old", conversationId, peerId, "", 800),
    kind: "document",
    document: { fileName: "Fabric price list.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 482113, url: null },
    mediaExpiresAt: new Date(new Date(isoDateHoursAgo(800)).getTime() + DOCUMENT_RETENTION_MS).toISOString(),
  },
  {
    ...buildText("m_poll_peer", conversationId, peerId, "Which colour for the aso-ebi?", 3),
    kind: "poll",
    poll: {
      question: "Which colour for the aso-ebi?",
      allowMultipleAnswers: false,
      options: [
        { id: "opt_gold", text: "Gold and ivory", voteCount: 3, votedByMe: false },
        { id: "opt_green", text: "Emerald green", voteCount: 5, votedByMe: false },
        { id: "opt_red", text: "Wine red", voteCount: 1, votedByMe: false },
      ],
    },
  },
];

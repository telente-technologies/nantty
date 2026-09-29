import type { Conversation, Message, UserSummary } from "@/types";

import { isoDateHoursAgo, me } from "./fixtures.mock";
import type { DirectoryUserKey } from "./mockImages.mock";
import { userSummaryById } from "./userDirectory.mock";

type ScriptLine = readonly [from: "me" | "peer", text: string, hoursAgo: number];

interface ConversationSeed {
  readonly id: string;
  readonly peerKey: DirectoryUserKey;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly script: readonly ScriptLine[];
}

const CONVERSATION_SEEDS: readonly ConversationSeed[] = [
  {
    id: "c_ada", peerKey: "u_1", unread: 2, isFriend: true,
    script: [
      ["me", "Hi Adaeze! Is the green & gold wrap dress available in UK 12?", 5],
      ["peer", "Hello dear 😊 Yes, I have two left in UK 12.", 4.8],
      ["peer", "If you order today it ships tomorrow morning with GIG.", 4.7],
    ],
  },
  {
    id: "c_tunde", peerKey: "u_2", unread: 0, isFriend: false,
    script: [
      ["me", "Do the headphones come with a warranty card?", 30],
      ["peer", "Yes boss, 1-year warranty. Keep the box and the receipt I'll include.", 29],
      ["me", "Perfect, just confirmed receipt. Sound is 🔥", 26],
      ["peer", "Thank you for your patronage! 🙏🏾", 25.5],
    ],
  },
  {
    id: "c_bisola", peerKey: "u_10", unread: 1, isFriend: true,
    script: [
      ["peer", "Babe I just ordered your clay pot! Is it okay for pepper soup?", 3],
      ["me", "Yesss, it's perfect for pepper soup. Season it first — instructions are in the box 😘", 2.8],
      ["peer", "Okay o. Please send it fast, my in-laws are coming Saturday 😂", 2.5],
    ],
  },
  {
    id: "c_support", peerKey: "u_25", unread: 0, isFriend: false,
    script: [
      ["peer", "Hi Temitope, we've reviewed the photos for order ZM-44104. Would you prefer a replacement or a refund?", 70],
      ["me", "A replacement please, if Emeka has my size.", 68],
      ["peer", "Noted. Your payment stays in escrow until the replacement arrives and you confirm it.", 67],
    ],
  },
  {
    id: "c_chinedu", peerKey: "u_7", unread: 0, isFriend: true,
    script: [
      ["peer", "Bro your mugs are fire. Ordered two sets for the office.", 9],
      ["me", "Thank you Chinedu! I'll pack them well. Shipping by tomorrow.", 8.5],
    ],
  },
  {
    id: "c_amaka", peerKey: "u_13", unread: 3, isFriend: true,
    script: [
      ["peer", "Hey! Loved your candles. Would you like to do a collab live next Friday?", 52],
      ["peer", "I can pin your products and we split affiliate commission 💛", 51.9],
      ["peer", "Let me know by Wednesday so I can announce it", 50],
    ],
  },
];

const buildMessages = (seed: ConversationSeed): Message[] =>
  seed.script.map(([from, text, hoursAgo], index) => ({
    id: `m_${seed.id}_${index}`,
    conversationId: seed.id,
    senderId: from === "me" ? me.id : seed.peerKey,
    text,
    createdAt: isoDateHoursAgo(hoursAgo),
  }));

export const seedConversations: readonly Conversation[] = CONVERSATION_SEEDS.map((seed) => {
  const lastLine = seed.script[seed.script.length - 1]!;
  return {
    id: seed.id,
    peer: userSummaryById(seed.peerKey),
    lastMessage: lastLine[1],
    lastMessageAt: isoDateHoursAgo(lastLine[2]),
    unread: seed.unread,
    isFriend: seed.isFriend,
  };
});

export const seedMessagesByConversationId: ReadonlyMap<string, readonly Message[]> = new Map(
  CONVERSATION_SEEDS.map((seed) => [seed.id, buildMessages(seed)]),
);

export const peopleToMessage: readonly UserSummary[] = (["u_1", "u_2", "u_3", "u_7", "u_9", "u_10", "u_13", "u_15", "u_25"] as const).map(userSummaryById);

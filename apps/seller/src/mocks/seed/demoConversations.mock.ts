import type { Conversation, ConversationMessage } from "@/types/conversation.type";

export interface MockSeedMessage {
  readonly id: string;
  readonly from: "customer" | "seller";
  readonly text: string;
  readonly createdAt: string;
}
import type { OnlineOrder } from "@/types/order.type";

export interface MockConversationRecord {
  conversation: Conversation;
  messages: ConversationMessage[];
  seeds: MockSeedMessage[];
}

const orderLinkedScripts: readonly (readonly [from: "customer" | "seller", body: string])[][] = [
  [["customer", "Good afternoon, please when will my order be shipped?"], ["seller", "Good afternoon! We are packing it today and it goes out with GIG tomorrow morning."], ["customer", "Thank you so much 🙏🏾"]],
  [["customer", "Hello, can I change the size to L instead of M?"], ["seller", "Yes, we still have L in stock. I have updated it for you."], ["customer", "You are the best. Please add a gift note: Happy birthday Mum."]],
  [["customer", "The rider called but I was in a meeting. Can he come back after 4pm?"]],
  [["customer", "I have received it, the quality is really nice!"], ["seller", "We are so glad you like it. Please leave us a review in the app 😊"]],
  [["customer", "Is this the original colour? It looks lighter than the photo."], ["seller", "It is the same batch. Lighting in photos can make it look darker — happy to swap if you prefer."]],
  [["customer", "Please do you deliver to Lokoja?"], ["seller", "Yes we do, it takes 3–5 working days with Sendbox."], ["customer", "Okay I will place the order now."]],
];

const generalEnquiries: readonly { readonly name: string; readonly username: string; readonly messages: readonly (readonly [from: "customer" | "seller", body: string])[] }[] = [
  { name: "Halima Abdullahi", username: "halima.abdul", messages: [["customer", "Do you have this bag in black? I saw it on your clip yesterday."]] },
  { name: "Kunle Adeyemi", username: "kunle.adeyemi", messages: [["customer", "Can I buy 20 pieces for my shop? What is your wholesale price?"], ["seller", "Yes! For 20 pieces we can do 12% off. Should I create a bundle for you?"], ["customer", "Yes please"]] },
  { name: "Ifunanya Okeke", username: "ifunanya.okeke", messages: [["customer", "Hi, are you open on Sunday for pickup?"]] },
  { name: "Bolaji Ogunbanjo", username: "bolaji.ogb", messages: [["customer", "When are you restocking the ankara tote?"], ["seller", "Next Friday. I will message you as soon as it is live."]] },
];

function buildMessagesFromScript(conversationId: string, script: readonly (readonly ["customer" | "seller", string])[], _customerName: string, _sellerName: string, startEpochMs: number): MockSeedMessage[] {
  return script.map(([from, text], messageIndex) => ({ id: `${conversationId}_m${messageIndex + 1}`, from, text, createdAt: new Date(startEpochMs + messageIndex * 23 * 60_000).toISOString() }));
}

function finishConversation(base: Omit<Conversation, "lastMessage" | "unreadCount" | "updatedAt">, seeds: MockSeedMessage[]): MockConversationRecord {
  const lastMessage = seeds[seeds.length - 1] ?? null;
  const unreadCount = lastMessage?.from === "customer" ? seeds.filter((message, index) => message.from === "customer" && seeds.slice(index).every((later) => later.from === "customer")).length : 0;
  return {
    conversation: { ...base, lastMessage: lastMessage ? { kind: "text", from: lastMessage.from, createdAt: lastMessage.createdAt } : null, unreadCount, updatedAt: lastMessage?.createdAt ?? new Date().toISOString() },
    messages: [],
    seeds,
  };
}

export function buildDemoConversations(orders: readonly OnlineOrder[], sellerName: string): MockConversationRecord[] {
  const records: MockConversationRecord[] = [];
  orders.filter((order) => order.conversationId).forEach((order, index) => {
    const conversationId = order.conversationId as string;
    const script = orderLinkedScripts[index % orderLinkedScripts.length] ?? [];
    const startEpochMs = new Date(order.createdAt).getTime() + 2 * 3_600_000;
    const messages = buildMessagesFromScript(conversationId, script, order.buyer.name, sellerName, startEpochMs);
    records.push(finishConversation({ id: conversationId, customer: { id: order.buyer.id, name: order.buyer.name, username: order.buyer.username, avatarUrl: null }, orderId: order.id, orderNumber: order.orderNumber }, messages));
  });
  generalEnquiries.forEach((enquiry, index) => {
    const conversationId = `conv_general_${index + 1}`;
    const startEpochMs = Date.now() - (index * 2 + 1) * 3_600_000 * 5;
    const messages = buildMessagesFromScript(conversationId, enquiry.messages, enquiry.name, sellerName, startEpochMs);
    records.push(finishConversation({ id: conversationId, customer: { id: `usr_enq_${index + 1}`, name: enquiry.name, username: enquiry.username, avatarUrl: null }, orderId: null, orderNumber: null }, messages));
  });
  return records.sort((left, right) => right.conversation.updatedAt.localeCompare(left.conversation.updatedAt));
}

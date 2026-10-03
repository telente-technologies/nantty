import { registerConversationMockHandlers } from "@/mocks/handlers/conversationHandlers.mock";
import { registerDeliveryMockHandlers } from "@/mocks/handlers/deliveryHandlers.mock";
import { registerShippingMockHandlers } from "@/mocks/handlers/shippingHandlers.mock";

export function registerDeliveryAndMessagesMockHandlers(): void {
  registerDeliveryMockHandlers();
  registerShippingMockHandlers();
  registerConversationMockHandlers();
}

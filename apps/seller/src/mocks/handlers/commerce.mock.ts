import { registerCustomerMockHandlers } from "@/mocks/handlers/customerHandlers.mock";
import { registerOrderMockHandlers } from "@/mocks/handlers/orderHandlers.mock";
import { registerOrderReturnAndDisputeMockHandlers } from "@/mocks/handlers/orderReturnsAndDisputes.mock";
import { registerPromotionMockHandlers } from "@/mocks/handlers/promotionHandlers.mock";

export function registerCommerceMockHandlers(): void {
  registerOrderMockHandlers();
  registerOrderReturnAndDisputeMockHandlers();
  registerCustomerMockHandlers();
  registerPromotionMockHandlers();
}

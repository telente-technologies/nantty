import type { Product, ProductCategory } from "@/types/catalog.type";
import type { Money } from "@/types/money.type";
import type { CreateSaleRequest, DiscountInput, PosSale } from "@/types/pos.type";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { PaymentMethod, PosRegister, StoreSettings } from "@/types/store.type";

export interface PosCatalogSnapshot {
  readonly locationId: string;
  readonly products: Product[];
  readonly categories: ProductCategory[];
  readonly settings: StoreSettings;
  readonly generatedAt: string;
}

export interface DiscountApprovalRequest {
  readonly staffId: string;
  readonly pin: string;
  readonly discountMinor: number;
  readonly grossMinor: number;
  readonly reason: string;
}

export interface DiscountApproval {
  readonly approvalId: string;
  readonly approvedBy: { readonly id: string; readonly name: string };
  readonly expiresAt: string;
}

export type PayLinkStatus = "pending" | "paid" | "expired";

export interface PosPayLink {
  readonly reference: string;
  readonly url: string;
  readonly amount: Money;
  readonly status: PayLinkStatus;
  readonly expiresAt: string;
}

export type ReceiptShareChannel = "email" | "sms" | "whatsapp";

export interface ReceiptShareResult {
  readonly url: string;
  readonly message: string;
  readonly channel: ReceiptShareChannel;
  readonly sentTo: string | null;
}

export interface PinRosterEntry {
  readonly staffId: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly locked: boolean;
}

export interface PromotionCodeValidation {
  readonly promotionId: string;
  readonly code: string;
  readonly discount: { readonly kind: "percent" | "amount"; readonly value: number };
  readonly message: string;
}

export interface PosCartLine {
  readonly lineId: string;
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly taxable: boolean;
  readonly categoryId: string | null;
  readonly discount: DiscountInput | null;
}

export interface PosCartCustomer {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly loyaltyPoints: number;
}

export interface PosCartState {
  readonly clientSaleId: string;
  readonly lines: PosCartLine[];
  readonly cartDiscount: DiscountInput | null;
  readonly customer: PosCartCustomer | null;
  readonly coupon: PromotionCodeValidation | null;
  readonly loyaltyPointsToRedeem: number;
}

export interface PendingPayment {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly amountMinor: number;
  readonly tenderedMinor: number | null;
  readonly reference: string | null;
}

export interface OfflineSaleOrigin {
  readonly storeId: string | null;
  readonly operatorPass: string | null;
}

export interface QueuedOfflineSale extends Partial<OfflineSaleOrigin> {
  readonly clientSaleId: string;
  readonly request: CreateSaleRequest;
  readonly localSale: PosSale;
  readonly queuedAt: string;
  readonly status: "queued" | "failed";
  readonly attempts: number;
  readonly lastError: string | null;
}

export interface LocallyParkedSale {
  readonly id: string;
  readonly registerId: string;
  readonly label: string;
  readonly customerName: string | null;
  readonly itemsCount: number;
  readonly total: Money;
  readonly cart: PosCartState;
  readonly createdAt: string;
}

export type PosRegisterList = PosRegister[];

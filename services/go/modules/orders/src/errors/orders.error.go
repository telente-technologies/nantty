package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

func Api(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

var (
	DirectPaymentNotAllowed          = Api(http.StatusUnprocessableEntity, "DIRECT_PAYMENT_NOT_ALLOWED", "This store is not verified, so its orders can only be paid through escrow.")
	CartEmpty                        = Api(http.StatusUnprocessableEntity, "CART_EMPTY", "Your cart is empty.")
	CartItemNotFound                 = Api(http.StatusNotFound, "CART_ITEM_NOT_FOUND", "That cart item could not be found.")
	ProductUnavailable               = Api(http.StatusConflict, "PRODUCT_UNAVAILABLE", "That product is not available right now.")
	VariantNotFound                  = Api(http.StatusNotFound, "VARIANT_NOT_FOUND", "That variant could not be found.")
	VariantRequired                  = Api(http.StatusUnprocessableEntity, "VARIANT_REQUIRED", "Choose a size or color for this product.")
	CannotBuyOwnProduct              = Api(http.StatusForbidden, "CANNOT_BUY_OWN_PRODUCT", "You cannot buy from your own store.")
	CheckoutCurrencyNotSupported     = Api(http.StatusUnprocessableEntity, "CHECKOUT_CURRENCY_NOT_SUPPORTED", "Checkout is not available in this store's currency yet.")
	MixedCurrencies                  = Api(http.StatusUnprocessableEntity, "MIXED_CURRENCIES", "Items from stores that sell in different currencies must be bought separately.")
	AddressNotFound                  = Api(http.StatusNotFound, "ADDRESS_NOT_FOUND", "That delivery address could not be found.")
	NothingDeliverable               = Api(http.StatusUnprocessableEntity, "NOT_DELIVERABLE", "None of the sellers in your cart ship to that address.")
	InsufficientStock                = Api(http.StatusConflict, "INSUFFICIENT_STOCK", "There is not enough stock for one of the items.")
	PaymentServiceFailed             = Api(http.StatusBadGateway, "PAYMENT_SERVICE_UNAVAILABLE", "We could not prepare the payment. Try again in a moment.")
	SellerVerificationRequiredToSell = Api(http.StatusForbidden, "VERIFICATION_REQUIRED", "This seller must finish identity verification before they can sell in your country. Remove their items to continue.")
	SellerSalesCapReached            = Api(http.StatusConflict, "SELLER_SALES_CAP_REACHED", "This store has reached its sales limit while the seller's business verification is pending. Remove its items or try again later.")
	SellerDebtLimit                  = Api(http.StatusForbidden, "SELLER_DEBT_LIMIT", "This store can't take new orders right now. Remove its items or try again later.")
	PaymentAmountOutOfRange          = Api(http.StatusUnprocessableEntity, "PAYMENT_AMOUNT_OUT_OF_RANGE", "This order is above the most that can be paid at once. Contact support to place a large order.")
	SellerVerificationUnavailable    = Api(http.StatusServiceUnavailable, "SELLER_VERIFICATION_UNAVAILABLE", "We could not confirm the seller's verification. Try again in a moment.")
	OrderNotFound                    = Api(http.StatusNotFound, "ORDER_NOT_FOUND", "That order could not be found.")
	InvalidStatusChange              = Api(http.StatusConflict, "INVALID_STATUS_CHANGE", "That change is not allowed for the order's current status.")
	OrderNotNew                      = Api(http.StatusConflict, "ORDER_NOT_NEW", "Only new orders can be accepted or rejected.")
	OrderNotShippable                = Api(http.StatusConflict, "ORDER_NOT_SHIPPABLE", "That order cannot be shipped in its current status.")
	OrderNotCancellable              = Api(http.StatusConflict, "ORDER_NOT_CANCELLABLE", "That order can no longer be cancelled.")
	RefundAmountInvalid              = Api(http.StatusUnprocessableEntity, "REFUND_AMOUNT_INVALID", "Enter a refund amount above zero.")
	OrderNotRefundable               = Api(http.StatusConflict, "ORDER_NOT_REFUNDABLE", "This order has already been refunded or a refund is on its way.")
	OrderRefundDisputed              = Api(http.StatusConflict, "ORDER_NOT_REFUNDABLE", "Nantty decides refunds while a dispute is open.")
	OrderRefundOnlyInFull            = Api(http.StatusConflict, "ORDER_NOT_REFUNDABLE", "This order was already paid out to you, so it can only be refunded in full.")
	OrderNotConfirmable              = Api(http.StatusConflict, "ORDER_NOT_CONFIRMABLE", "Only delivered orders can be confirmed.")
	NotInTransit                     = Api(http.StatusConflict, "NOT_IN_TRANSIT", "Only shipments in transit can record a delivery attempt.")
	StockUnavailableAtShip           = Api(http.StatusConflict, "INSUFFICIENT_STOCK", "The chosen location does not have enough stock to ship this order.")
	InvalidLocation                  = Api(http.StatusBadRequest, "INVALID_LOCATION", "That location does not belong to this store.")
	RuleNotFound                     = Api(http.StatusNotFound, "RULE_NOT_FOUND", "That shipping rule could not be found.")
	RuleLimitReached                 = Api(http.StatusConflict, "RULE_LIMIT_REACHED", "This store reached the shipping rule limit.")
	ProfileNotFound                  = Api(http.StatusNotFound, "SHIPPING_PROFILE_NOT_FOUND", "That shipping profile could not be found.")
	ZoneNotFound                     = Api(http.StatusNotFound, "SHIPPING_ZONE_NOT_FOUND", "That shipping zone could not be found.")
	DestinationInvalid               = Api(http.StatusUnprocessableEntity, "DESTINATION_INVALID", "That destination is not a known country, region or area.")
	CustomerNotFound                 = Api(http.StatusNotFound, "CUSTOMER_NOT_FOUND", "That customer could not be found.")
	ReportNotFound                   = Api(http.StatusNotFound, "REPORT_NOT_FOUND", "That report does not exist.")
	ExportNotFound                   = Api(http.StatusNotFound, "EXPORT_NOT_FOUND", "That export could not be found.")
	RewardsNotConfigured             = Api(http.StatusUnprocessableEntity, "REWARDS_INVALID", "Those reward settings are not valid.")
)

var (
	DeliveryAreaNotFound     = Api(http.StatusNotFound, "AREA_NOT_FOUND", "That delivery area could not be found.")
	DeliveryAreaLimitReached = Api(http.StatusConflict, "AREA_LIMIT_REACHED", "A store can have up to 50 delivery areas.")
	CustomerExists           = Api(http.StatusConflict, "CUSTOMER_EXISTS", "A customer with that phone or email already exists.")
	SegmentNotFound          = Api(http.StatusNotFound, "SEGMENT_NOT_FOUND", "That segment could not be found.")
	SegmentLimitReached      = Api(http.StatusConflict, "SEGMENT_LIMIT_REACHED", "A store can have up to 20 custom segments.")
)

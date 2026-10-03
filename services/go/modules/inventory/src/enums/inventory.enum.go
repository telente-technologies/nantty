package enums

const (
	MovementAdjustment    = "adjustment"
	MovementTransferOut   = "transfer_out"
	MovementTransferIn    = "transfer_in"
	MovementOrderReserved = "order_reserved"
	MovementOrderReleased = "order_released"
	MovementOrderShipped  = "order_shipped"
	MovementOrderReturned = "order_returned"
	MovementOpeningStock  = "adjustment"
)

const (
	ReservationActive    = "active"
	ReservationConfirmed = "confirmed"
	ReservationReleased  = "released"
	ReservationExpired   = "expired"
	ReservationFulfilled = "fulfilled"
)

const (
	TransferInTransit = "in_transit"
	TransferReceived  = "received"
	TransferCancelled = "cancelled"
)

const (
	LocationKindStore     = "store"
	LocationKindWarehouse = "warehouse"
)

var AdjustmentReasons = []string{"received", "count", "damaged", "theft", "returned", "expired", "other"}

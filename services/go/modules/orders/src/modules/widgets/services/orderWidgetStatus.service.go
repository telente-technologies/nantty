package services

import "nantty/modules/orders/src/enums"

var ActiveOrderStatuses = []string{enums.StatusNew, enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered}

var SellerStatusesAwaitingShipment = []string{enums.StatusNew, enums.StatusProcessing, enums.StatusReady}

type OrderWidgetStatus struct {
	Key   string
	Label string
}

func OrderWidgetStatusFor(status, deliveryStatus string, riderAssigned bool) OrderWidgetStatus {
	switch status {
	case enums.StatusNew:
		return OrderWidgetStatus{"confirmed", "Order confirmed"}
	case enums.StatusProcessing:
		return OrderWidgetStatus{"preparing", "Being prepared"}
	case enums.StatusReady:
		return OrderWidgetStatus{"ready_to_ship", "Ready to ship"}
	case enums.StatusShipped:
		if deliveryStatus == "failed" {
			return OrderWidgetStatus{"delivery_failed", "Delivery attempt failed"}
		}
		if riderAssigned {
			return OrderWidgetStatus{"out_for_delivery", "Out for delivery"}
		}
		return OrderWidgetStatus{"in_transit", "On the way"}
	case enums.StatusDelivered:
		return OrderWidgetStatus{"delivered", "Delivered"}
	}
	return OrderWidgetStatus{"other", "Order update"}
}

func OrderDeepLink(orderId string) string { return "zudomart://orders/" + orderId }

const SellerDashboardDeepLink = "zudomart://seller/dashboard"

package getanalyticsoverview

import (
	"nantty/modules/orders/src/modules/sellerInsights/services"
	"nantty/platform/commerceports"
)

type Query struct {
	Store  commerceports.StoreAccess
	Window services.AnalyticsRange
}

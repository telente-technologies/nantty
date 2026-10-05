package getanalyticsoverview

import (
	"zudomart/modules/orders/src/modules/sellerInsights/services"
	"zudomart/platform/commerceports"
)

type Query struct {
	Store  commerceports.StoreAccess
	Window services.AnalyticsRange
}

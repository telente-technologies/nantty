package interfaces

import (
	"net/http"

	"nantty/platform/regionpricing"
)

type ViewerCurrencyResolver interface {
	ResolveViewerCurrency(request *http.Request) string
	ResolvePricingRegion(request *http.Request) regionpricing.Resolution
	ResolveChargingRegion(request *http.Request) regionpricing.Resolution
}

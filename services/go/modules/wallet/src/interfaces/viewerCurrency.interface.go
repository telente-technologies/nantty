package interfaces

import (
	"net/http"

	"zudomart/platform/regionpricing"
)

type ViewerCurrencyResolver interface {
	ResolveViewerCurrency(request *http.Request) string
	ResolvePricingRegion(request *http.Request) regionpricing.Resolution
}

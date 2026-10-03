package interfaces

import "net/http"

type ViewerCurrencyResolver interface {
	ResolveViewerCurrency(request *http.Request) string
}

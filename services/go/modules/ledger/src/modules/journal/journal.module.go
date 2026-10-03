package journal

import (
	"net/http"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/modules/journal/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountJournalRoutes(mux, container)
}

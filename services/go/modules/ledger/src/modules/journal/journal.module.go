package journal

import (
	"net/http"

	"nantty/modules/ledger/src/container"
	"nantty/modules/ledger/src/modules/journal/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountJournalRoutes(mux, container)
}

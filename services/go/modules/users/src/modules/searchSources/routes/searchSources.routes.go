package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/searchSources/controllers"
)

func MountSearchSourcesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SearchSourcesController{Container: deployed}
	mux.HandleFunc("GET /api/v1/internal/search-sources/users/{id}", controller.GetUserSearchSource)
}

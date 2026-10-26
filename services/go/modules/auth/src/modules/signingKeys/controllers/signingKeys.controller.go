package controllers

import (
	"net/http"

	"nantty/modules/auth/src/container"
	getjsonwebkeyset "nantty/modules/auth/src/modules/signingKeys/queries/getJsonWebKeySet"
	"nantty/platform/httpserver"
)

type SigningKeysController struct {
	Container *container.Container
}

func (controller SigningKeysController) ServeJsonWebKeySet(writer http.ResponseWriter, request *http.Request) {
	encoded, err := getjsonwebkeyset.Handler{Container: controller.Container}.Execute(request.Context(), getjsonwebkeyset.Query{})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Content-Type", "application/jwk-set+json")
	writer.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = writer.Write(encoded)
}

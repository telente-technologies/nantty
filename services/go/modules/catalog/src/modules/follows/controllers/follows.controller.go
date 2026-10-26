package controllers

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	setfollow "nantty/modules/catalog/src/modules/follows/commands/setFollow"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type FollowsController struct {
	Container *container.Container
}

func (controller FollowsController) Set(kind, pathName string, follow bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		targetId, err := utils.PathIdentifier(request, pathName)
		if err == nil {
			err = (setfollow.Handler{Container: controller.Container}).Execute(request.Context(), setfollow.Command{
				AccountId: middlewares.AccountIdFrom(request.Context()), TargetKind: kind, TargetId: targetId, Follow: follow,
			})
		}
		if err != nil {
			utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
			return
		}
		httpserver.WriteNoContentResponse(writer)
	}
}

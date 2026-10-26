package controllers

import (
	"context"
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/widgets/dtos"
	listfollowedlives "nantty/modules/live/src/modules/widgets/queries/listFollowedLives"
	"nantty/modules/live/src/utils"
	"nantty/platform/widgets"
)

const livesShownOnWidget = 8

type WidgetsController struct {
	Container *container.Container
	cache     *widgets.ResponseCache[dtos.LiveNowWidgetPayload]
}

func NewWidgetsController(deployed *container.Container) WidgetsController {
	return WidgetsController{Container: deployed, cache: widgets.NewResponseCache[dtos.LiveNowWidgetPayload](widgets.DefaultCacheTimeToLive, widgets.DefaultCacheEntries, deployed.Now)}
}

func (controller WidgetsController) LiveNow(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	actor, err := utils.ActorFrom(request)
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	payload, err := controller.cache.GetOrLoad(request.Context(), actor.UserId.String(), func(ctx context.Context) (dtos.LiveNowWidgetPayload, error) {
		return listfollowedlives.Handler{Container: controller.Container}.Execute(ctx, listfollowedlives.Query{ViewerId: actor.UserId, Limit: livesShownOnWidget})
	})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	widgets.WriteWidgetJson(writer, payload)
}

package controllers

import (
	"context"
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/widgets/dtos"
	listfollowedlives "zudomart/modules/live/src/modules/widgets/queries/listFollowedLives"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/widgets"
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

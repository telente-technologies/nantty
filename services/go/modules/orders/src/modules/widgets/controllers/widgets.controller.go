package controllers

import (
	"context"
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/widgets/dtos"
	getsellertoday "zudomart/modules/orders/src/modules/widgets/queries/getSellerToday"
	listactiveorders "zudomart/modules/orders/src/modules/widgets/queries/listActiveOrders"
	"zudomart/platform/httpserver"
	"zudomart/platform/widgets"
)

const activeOrdersShownOnWidget = 3

type WidgetsController struct {
	Container   *container.Container
	orders      *widgets.ResponseCache[dtos.OrderWidgetPayload]
	sellerToday *widgets.ResponseCache[dtos.SellerTodayWidgetPayload]
}

func NewWidgetsController(deployed *container.Container) WidgetsController {
	return WidgetsController{
		Container:   deployed,
		orders:      widgets.NewResponseCache[dtos.OrderWidgetPayload](widgets.DefaultCacheTimeToLive, widgets.DefaultCacheEntries, deployed.Now),
		sellerToday: widgets.NewResponseCache[dtos.SellerTodayWidgetPayload](widgets.DefaultCacheTimeToLive, widgets.DefaultCacheEntries, deployed.Now),
	}
}

func (controller WidgetsController) ActiveOrders(writer http.ResponseWriter, request *http.Request) {
	buyerId := middlewares.AccountIdFrom(request.Context())
	payload, err := controller.orders.GetOrLoad(request.Context(), buyerId.String(), func(ctx context.Context) (dtos.OrderWidgetPayload, error) {
		return listactiveorders.Handler{Container: controller.Container}.Execute(ctx, listactiveorders.Query{BuyerId: buyerId, Limit: activeOrdersShownOnWidget})
	})
	controller.respond(writer, request, payload, err)
}

func (controller WidgetsController) SellerToday(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	actorId := middlewares.AccountIdFrom(request.Context())
	hidden := widgets.AmountsHidden(request)
	cacheKey := actorId.String() + "|" + store.StoreId.String() + "|" + map[bool]string{true: "hidden", false: "shown"}[hidden]
	payload, err := controller.sellerToday.GetOrLoad(request.Context(), cacheKey, func(ctx context.Context) (dtos.SellerTodayWidgetPayload, error) {
		return getsellertoday.Handler{Container: controller.Container}.Execute(ctx, getsellertoday.Query{Store: store, ActorId: actorId, AmountsHidden: hidden})
	})
	controller.respond(writer, request, payload, err)
}

func (controller WidgetsController) respond(writer http.ResponseWriter, request *http.Request, payload any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	widgets.WriteWidgetJson(writer, payload)
}

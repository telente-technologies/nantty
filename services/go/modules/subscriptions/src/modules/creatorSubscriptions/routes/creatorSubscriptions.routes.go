package routes

import (
	"context"
	"errors"
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/controllers"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"zudomart/platform/httpserver"
)

type PlanSubscriptionLookup func(ctx context.Context, userId, subscriptionId string) (any, error)

func MountCreatorSubscriptionsRoutes(mux *http.ServeMux, controller controllers.CreatorSubscriptionsController, planSubscriptionOf PlanSubscriptionLookup) {
	requireUser := middlewares.RequireUserAccessToken(controller.Service.Container.Resources.AccessVerifier)
	user := func(handler http.HandlerFunc) http.Handler { return requireUser(handler) }
	mux.Handle("GET /api/v1/creators/me/subscription-plans", user(controller.MyPlans))
	mux.Handle("POST /api/v1/creators/me/subscription-plans", user(controller.CreatePlan))
	mux.Handle("PATCH /api/v1/creators/me/subscription-plans/{planId}", user(controller.UpdatePlan))
	mux.Handle("GET /api/v1/creators/me/subscription-plans/price-tiers", user(controller.PriceTiers))
	mux.Handle("GET /api/v1/creators/me/subscribers", user(controller.MySubscribers))
	mux.HandleFunc("GET /api/v1/creators/{creatorId}/subscription-plans", controller.CreatorPlans)
	mux.Handle("POST /api/v1/creators/{creatorId}/subscriptions", user(controller.Subscribe))
	mux.Handle("POST /api/v1/creators/{creatorId}/subscriptions/store", user(controller.StartStorePurchase))
	mux.Handle("POST /api/v1/creator-subscriptions/store-receipts", user(controller.RedeemStoreReceipt))
	mux.Handle("GET /api/v1/creator-subscriptions", user(controller.ListMine))
	mux.Handle("POST /api/v1/creator-subscriptions/verify", user(controller.Verify))
	mux.Handle("GET /api/v1/creator-subscriptions/{subscriptionId}", user(controller.Get))
	mux.Handle("POST /api/v1/creator-subscriptions/{subscriptionId}/cancel", user(controller.Cancel))
	mux.Handle("POST /api/v1/creator-subscriptions/{subscriptionId}/resume", user(controller.Resume))
	mux.Handle("GET /api/v1/subscriptions/{subscriptionId}", user(func(writer http.ResponseWriter, request *http.Request) {
		principal, err := ledgerutils.RequirePrincipal(request)
		if err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Service.Container.Resources.Logger, err)
			return
		}
		row, err := controller.Service.FindForMember(request.Context(), principal.UserId, request.PathValue("subscriptionId"))
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, services.ConvertCreatorSubscription(row))
			return
		}
		if !errors.Is(err, services.ErrCreatorSubscriptionGone) || planSubscriptionOf == nil {
			httpserver.WriteErrorResponse(writer, request, controller.Service.Container.Resources.Logger, err)
			return
		}
		view, err := planSubscriptionOf(request.Context(), principal.UserId, request.PathValue("subscriptionId"))
		if err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Service.Container.Resources.Logger, err)
			return
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, view)
	}))
}

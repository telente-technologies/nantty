package controllers

import (
	"context"
	"net/http"
	"strings"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/dtos"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"zudomart/platform/httpserver"
)

func (controller CreatorSubscriptionsController) Subscribe(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StartSubscriptionRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireUuid("planId", body.PlanId)
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		if body.Provider != "" {
			collector.RequireOneOf("provider", body.Provider, "flutterwave")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := controller.Service.StartSubscription(request.Context(), services.StartCreatorSubscription{
		SubscriberId: principal.UserId, CreatorId: request.PathValue("creatorId"), PlanId: body.PlanId, ReturnTo: body.ReturnTo,
		ClientPlatform: strings.ToLower(request.Header.Get("X-Client-Platform")), IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, view, replayed)
}

func (controller CreatorSubscriptionsController) Verify(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.VerifySubscriptionRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reference", body.Reference, 6, 80)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Service.VerifyPayment(request.Context(), principal.UserId, body.Reference)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller CreatorSubscriptionsController) ListMine(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Service.ListMine(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, ""))
}

func (controller CreatorSubscriptionsController) Get(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := controller.Service.FindForMember(request.Context(), principal.UserId, request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, services.ConvertCreatorSubscription(row))
}

func (controller CreatorSubscriptionsController) Cancel(writer http.ResponseWriter, request *http.Request) {
	controller.change(writer, request, controller.Service.Cancel)
}

func (controller CreatorSubscriptionsController) Resume(writer http.ResponseWriter, request *http.Request) {
	controller.change(writer, request, controller.Service.Resume)
}

func (controller CreatorSubscriptionsController) change(writer http.ResponseWriter, request *http.Request, apply func(ctx context.Context, subscriberId, subscriptionId string) (services.CreatorSubscriptionStateView, error)) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := apply(request.Context(), principal.UserId, request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

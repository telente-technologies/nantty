package controllers

import (
	"net/http"
	"strings"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/dtos"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"zudomart/platform/httpserver"
)

type CreatorSubscriptionsController struct {
	Service services.CreatorSubscriptions
}

func (controller CreatorSubscriptionsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Service.Container.Resources.Logger, err)
}

func validateBenefits(collector *ledgerutils.IssueCollector, benefits []dtos.BenefitDto) {
	if len(benefits) > models.CreatorPlanMaximumBenefits {
		collector.Add("benefits", "use at most 20 benefits")
	}
	for _, benefit := range benefits {
		collector.RequireLength("benefits[].name", benefit.Name, 1, 120)
		collector.RequireLength("benefits[].description", benefit.Description, 0, 500)
	}
}

func (controller CreatorSubscriptionsController) CreatePlan(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CreatePlanRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("name", strings.TrimSpace(body.Name), 1, 80)
		collector.RequireLength("description", body.Description, 0, 1000)
		collector.RequireRange("price.amountMinor", body.Price.AmountMinor, models.CreatorPlanMinimumMinor, 1_000_000_000)
		collector.RequireLength("price.currency", body.Price.Currency, 3, 3)
		if body.Interval != "" {
			collector.RequireOneOf("interval", body.Interval, "month", "year")
		}
		validateBenefits(collector, body.Benefits)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	interval := body.Interval
	if interval == "" {
		interval = "month"
	}
	plan, err := controller.Service.CreatePlan(request.Context(), services.NewCreatorPlan{
		CreatorId: principal.UserId, Name: strings.TrimSpace(body.Name), Description: body.Description, AmountMinor: body.Price.AmountMinor,
		Currency: body.Price.Currency, Interval: interval, Benefits: dtos.ConvertBenefits(body.Benefits),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, plan)
}

func (controller CreatorSubscriptionsController) UpdatePlan(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.UpdatePlanRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if body.Name != nil {
			collector.RequireLength("name", strings.TrimSpace(*body.Name), 1, 80)
		}
		if body.Description != nil {
			collector.RequireLength("description", *body.Description, 0, 1000)
		}
		if body.Benefits != nil {
			validateBenefits(collector, *body.Benefits)
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	change := services.CreatorPlanChange{Name: body.Name, Description: body.Description, Active: body.Active}
	if body.Benefits != nil {
		benefits := dtos.ConvertBenefits(*body.Benefits)
		change.Benefits = &benefits
	}
	plan, err := controller.Service.UpdatePlan(request.Context(), principal.UserId, request.PathValue("planId"), change)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, plan)
}

func (controller CreatorSubscriptionsController) MyPlans(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	plans, err := controller.Service.ListPlans(request.Context(), principal.UserId, true)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(plans, ""))
}

func (controller CreatorSubscriptionsController) CreatorPlans(writer http.ResponseWriter, request *http.Request) {
	plans, err := controller.Service.ListPlans(request.Context(), request.PathValue("creatorId"), false)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=30")
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(plans, ""))
}

func (controller CreatorSubscriptionsController) MySubscribers(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	subscribers, err := controller.Service.ListSubscribers(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(subscribers, ""))
}

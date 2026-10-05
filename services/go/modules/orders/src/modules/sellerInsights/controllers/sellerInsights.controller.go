package controllers

import (
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	getanalyticsbreakdowns "zudomart/modules/orders/src/modules/sellerInsights/queries/getAnalyticsBreakdowns"
	getanalyticsoverview "zudomart/modules/orders/src/modules/sellerInsights/queries/getAnalyticsOverview"
	getsellerdashboard "zudomart/modules/orders/src/modules/sellerInsights/queries/getSellerDashboard"
	"zudomart/modules/orders/src/modules/sellerInsights/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
	"zudomart/platform/sellerplans"
)

type SellerInsightsController struct {
	Container *container.Container
}

func (controller SellerInsightsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller SellerInsightsController) Dashboard(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	query := getsellerdashboard.Query{Store: store, ActorId: middlewares.AccountIdFrom(request.Context()), Period: request.URL.Query().Get("period")}
	if query.Period != "" && !slices.Contains(services.DashboardPeriods, query.Period) {
		controller.respond(writer, request, nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "period", Message: "must be one of live, today, yesterday, week, month, all"}}))
		return
	}
	if raw := request.URL.Query().Get("locationId"); raw != "" && raw != "all" {
		locationId, err := utils.OptionalQueryIdentifier(request, "locationId")
		if err == nil {
			err = requireStoreLocation(request, store, *locationId)
		}
		if err != nil {
			controller.respond(writer, request, nil, err)
			return
		}
		query.LocationId = locationId
	}
	view, err := getsellerdashboard.Handler{Container: controller.Container}.Execute(request.Context(), query)
	controller.respond(writer, request, view, err)
}

func requireStoreLocation(request *http.Request, store commerceports.StoreAccess, locationId uuid.UUID) error {
	inventory, err := commerceports.Default.InventoryStock()
	if err != nil {
		return err
	}
	owned, err := inventory.StoreOwnsLocations(request.Context(), store.StoreId, []uuid.UUID{locationId})
	if err != nil {
		return err
	}
	if !owned {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "locationId", Message: "must be one of your locations"}})
	}
	return nil
}

func (controller SellerInsightsController) readWindow(request *http.Request, store commerceports.StoreAccess) (services.AnalyticsRange, error) {
	location, err := time.LoadLocation(store.Timezone)
	if err != nil || store.Timezone == "" {
		location = time.UTC
	}
	now := controller.Container.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	from, to := today.AddDate(0, 0, -29), today
	var issues utils.Issues
	if raw := request.URL.Query().Get("from"); raw != "" {
		if from, err = time.ParseInLocation(time.DateOnly, raw, location); err != nil {
			issues.Add("from", "must be a date like 2026-10-01")
		}
	}
	if raw := request.URL.Query().Get("to"); raw != "" {
		if to, err = time.ParseInLocation(time.DateOnly, raw, location); err != nil {
			issues.Add("to", "must be a date like 2026-10-01")
		}
	}
	switch {
	case len(issues) > 0:
	case from.After(to):
		issues.Add("from", "must be on or before to")
	case to.After(today):
		issues.Add("to", "cannot be in the future")
	case to.Sub(from) > 731*24*time.Hour:
		issues.Add("from", "the range can cover at most 731 days")
	}
	if err := issues.AsError(); err != nil {
		return services.AnalyticsRange{}, err
	}
	window := services.AnalyticsRange{From: from, Until: to.AddDate(0, 0, 1), RequestedFrom: from}
	limit := sellerplans.LimitsFor(sellerplans.Default.PlanOf(request.Context(), store.OwnerAccountId)).AnalyticsHistoryDays
	if earliest := today.AddDate(0, 0, -(limit - 1)); window.From.Before(earliest) {
		window.From, window.LimitedToDays = earliest, &limit
		if !window.From.Before(window.Until) {
			window.From = window.Until.AddDate(0, 0, -1)
		}
	}
	return window, nil
}

func (controller SellerInsightsController) Overview(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	window, err := controller.readWindow(request, store)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	view, err := getanalyticsoverview.Handler{Container: controller.Container}.Execute(request.Context(), getanalyticsoverview.Query{Store: store, Window: window})
	controller.respond(writer, request, view, err)
}

func (controller SellerInsightsController) Breakdowns(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	window, err := controller.readWindow(request, store)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	view, err := getanalyticsbreakdowns.Handler{Container: controller.Container}.Execute(request.Context(), getanalyticsbreakdowns.Query{Store: store, Window: window})
	controller.respond(writer, request, view, err)
}

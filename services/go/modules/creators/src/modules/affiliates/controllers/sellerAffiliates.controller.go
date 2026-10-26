package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"nantty/modules/creators/src/modules/affiliates/dtos"
	"nantty/modules/creators/src/modules/affiliates/services"
	"nantty/modules/creators/src/repositories"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

func (controller AffiliatesController) store(writer http.ResponseWriter, request *http.Request) (string, repositories.StoreSummary, bool) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return "", repositories.StoreSummary{}, false
	}
	store, err := controller.Affiliates.SellerStore(request.Context(), principal.UserId, request.Header.Get("X-Seller-Store"))
	if err != nil {
		controller.fail(writer, request, err)
		return "", store, false
	}
	return principal.UserId, store, true
}

func (controller AffiliatesController) Settings(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		view, err := controller.Affiliates.Settings(request.Context(), store)
		controller.respond(writer, request, http.StatusOK, view, err)
	}
}

func (controller AffiliatesController) UpdateSettings(writer http.ResponseWriter, request *http.Request) {
	_, store, ok := controller.store(writer, request)
	if !ok {
		return
	}
	change := services.SettingsChange{}
	maximum := controller.Affiliates.MaximumBps()
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.SettingsPatchDto) error {
		collector := &ledgerutils.IssueCollector{}
		if body.DefaultCommissionBasisPoints != nil {
			collector.RequireRange("defaultCommissionBasisPoints", *body.DefaultCommissionBasisPoints, 0, maximum)
		}
		if body.CookieWindowDays != nil {
			collector.RequireRange("cookieWindowDays", int64(*body.CookieWindowDays), 1, 90)
		}
		if raw := body.AutoApproveCreatorsWithFollowersAbove; len(raw) > 0 && !bytes.Equal(raw, []byte("null")) {
			var threshold int64
			if json.Unmarshal(raw, &threshold) != nil {
				collector.Add("autoApproveCreatorsWithFollowersAbove", "must be a whole number or null")
			}
			collector.RequireRange("autoApproveCreatorsWithFollowersAbove", threshold, 0, 100_000_000)
			change.AutoApproveFollowersAbove = &threshold
		} else if bytes.Equal(raw, []byte("null")) {
			change.ClearAutoApprove = true
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	change.Enabled, change.DefaultCommissionBps, change.CookieWindowDays = body.Enabled, body.DefaultCommissionBasisPoints, body.CookieWindowDays
	view, err := controller.Affiliates.UpdateSettings(request.Context(), store, change)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller AffiliatesController) Overview(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		view, err := controller.Affiliates.Overview(request.Context(), store)
		controller.respond(writer, request, http.StatusOK, view, err)
	}
}

func (controller AffiliatesController) ProductCommissions(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		views, err := controller.Affiliates.ListProductCommissions(request.Context(), store, request.URL.Query().Get("q"), min(ledgerutils.ReadPageLimit(request)*10, 200))
		controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
	}
}

func (controller AffiliatesController) SetProductCommission(writer http.ResponseWriter, request *http.Request) {
	actor, store, ok := controller.store(writer, request)
	if !ok {
		return
	}
	maximum := controller.Affiliates.MaximumBps()
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ProductCommissionDto) error {
		collector := &ledgerutils.IssueCollector{}
		if body.CommissionBasisPoints != nil {
			collector.RequireRange("commissionBasisPoints", *body.CommissionBasisPoints, 0, maximum)
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	excluded := body.Excluded != nil && *body.Excluded
	view, err := controller.Affiliates.SetProductCommission(request.Context(), store, actor, request.PathValue("productId"), body.CommissionBasisPoints, excluded)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller AffiliatesController) Requests(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		views, err := controller.Affiliates.ListRequests(request.Context(), store, request.URL.Query().Get("status"), 200)
		controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
	}
}

func (controller AffiliatesController) DecideRequest(writer http.ResponseWriter, request *http.Request) {
	_, store, ok := controller.store(writer, request)
	if !ok {
		return
	}
	decision := request.PathValue("decision")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.DecisionDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("decision", decision, "approve", "decline")
		collector.RequireLength("reason", body.Reason, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Affiliates.DecideRequest(request.Context(), store, request.PathValue("requestId"), decision == "approve", body.Reason)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func readDay(value string) *time.Time {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil
	}
	return &parsed
}

func (controller AffiliatesController) Creators(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		to := readDay(request.URL.Query().Get("to"))
		if to != nil {
			end := to.AddDate(0, 0, 1)
			to = &end
		}
		views, err := controller.Affiliates.ListCreators(request.Context(), store, readDay(request.URL.Query().Get("from")), to)
		controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
	}
}

func (controller AffiliatesController) SetCreatorStatus(writer http.ResponseWriter, request *http.Request) {
	_, store, ok := controller.store(writer, request)
	if !ok {
		return
	}
	creatorId := request.PathValue("creatorId")
	if request.Method == http.MethodDelete {
		controller.respond(writer, request, http.StatusNoContent, nil, controller.Affiliates.SetCreatorStatus(request.Context(), store, creatorId, "removed"))
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CreatorStatusDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("status", body.Status, "active", "paused")
		return collector.Result()
	})
	if err == nil {
		err = controller.Affiliates.SetCreatorStatus(request.Context(), store, creatorId, body.Status)
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Affiliates.ListCreators(request.Context(), store, nil, nil)
	for _, view := range views {
		if view.Creator.Id == creatorId {
			controller.respond(writer, request, http.StatusOK, view, err)
			return
		}
	}
	controller.respond(writer, request, http.StatusOK, nil, services.ErrAffiliateNotFound)
}

func (controller AffiliatesController) CommissionLedger(writer http.ResponseWriter, request *http.Request) {
	if _, store, ok := controller.store(writer, request); ok {
		views, next, err := controller.Affiliates.CommissionLedger(request.Context(), store, request.URL.Query().Get("status"), request.URL.Query().Get("cursor"), ledgerutils.ReadPageLimit(request))
		controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, next), err)
	}
}

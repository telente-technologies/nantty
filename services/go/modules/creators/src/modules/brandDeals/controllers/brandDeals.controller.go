package controllers

import (
	"net/http"
	"strings"
	"time"

	"zudomart/modules/creators/src/modules/brandDeals/dtos"
	"zudomart/modules/creators/src/modules/brandDeals/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

const maximumBrandDealMinor = 1_000_000_000_000

type BrandDealsController struct {
	Deals services.BrandDeals
}

func (controller BrandDealsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Deals.Container.Resources.Logger, err)
}

func (controller BrandDealsController) List(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, next, err := controller.Deals.ListBrandDeals(request.Context(), principal.UserId, request.URL.Query().Get("cursor"), ledgerutils.ReadPageLimit(request))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, next))
}

func (controller BrandDealsController) Record(writer http.ResponseWriter, request *http.Request) {
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
	var startsAt time.Time
	var endsAt *time.Time
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.RecordBrandDealRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("brandName", strings.TrimSpace(body.BrandName), 1, 120)
		collector.RequireRange("amountMinor", body.AmountMinor, 0, maximumBrandDealMinor)
		if !regionpricing.IsSupportedCurrency(body.Currency) {
			collector.Add("currency", "is not a supported currency")
		}
		collector.RequireLength("disclosure", strings.TrimSpace(body.Disclosure), 1, 500)
		collector.RequireLength("notes", body.Notes, 0, 1000)
		parsed, parseError := time.Parse(time.RFC3339, body.StartsAt)
		if parseError != nil {
			collector.Add("startsAt", "must be an RFC 3339 date-time")
		}
		startsAt = parsed
		if body.EndsAt != nil {
			parsedEnd, endError := time.Parse(time.RFC3339, *body.EndsAt)
			switch {
			case endError != nil:
				collector.Add("endsAt", "must be an RFC 3339 date-time")
			case parseError == nil && parsedEnd.Before(parsed):
				collector.Add("endsAt", "cannot be before startsAt")
			default:
				endsAt = &parsedEnd
			}
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	recorded, err := controller.Deals.RecordBrandDeal(request.Context(), services.NewBrandDeal{
		CreatorId: principal.UserId, IdempotencyKey: key, BrandName: strings.TrimSpace(body.BrandName), AmountMinor: body.AmountMinor,
		Currency: strings.ToUpper(body.Currency), StartsAt: startsAt.UTC(), EndsAt: endsAt, Disclosure: strings.TrimSpace(body.Disclosure), Notes: strings.TrimSpace(body.Notes),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, recorded.Deal, recorded.Replayed)
}

func (controller BrandDealsController) Remove(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if err := controller.Deals.RemoveBrandDeal(request.Context(), principal.UserId, request.PathValue("dealId")); err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

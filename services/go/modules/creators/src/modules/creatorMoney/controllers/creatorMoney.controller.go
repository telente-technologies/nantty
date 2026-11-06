package controllers

import (
	"net/http"
	"unicode/utf8"

	"nantty/modules/creators/src/modules/creatorMoney/dtos"
	"nantty/modules/creators/src/modules/creatorMoney/services"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

type CreatorMoneyController struct {
	Money services.CreatorMoney
}

func (controller CreatorMoneyController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Money.Container.Resources.Logger, err)
}

func (controller CreatorMoneyController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller CreatorMoneyController) MyStatus(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	status, err := controller.Money.MyStatus(request.Context(), principal.UserId)
	controller.respond(writer, request, status, err)
}

func (controller CreatorMoneyController) RevenueRules(writer http.ResponseWriter, request *http.Request) {
	controller.respond(writer, request, controller.Money.RevenueRules(request.Context(), request.URL.Query().Get("currency")), nil)
}

func (controller CreatorMoneyController) Earnings(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	earnings, next, err := controller.Money.ListEarnings(request.Context(), principal.UserId, request.URL.Query().Get("cursor"), ledgerutils.ReadPageLimit(request))
	controller.respond(writer, request, httpserver.NewCursorPage(earnings, next), err)
}

func (controller CreatorMoneyController) Dashboard(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	period := request.URL.Query().Get("period")
	if period == "" {
		period = "month"
	}
	collector := &ledgerutils.IssueCollector{}
	collector.RequireOneOf("period", period, "today", "week", "month", "all")
	if err := collector.Result(); err != nil {
		controller.fail(writer, request, err)
		return
	}
	dashboard, err := controller.Money.BuildDashboard(request.Context(), principal.UserId, period, request.URL.Query().Get("currency"))
	controller.respond(writer, request, dashboard, err)
}

func (controller CreatorMoneyController) SendTip(writer http.ResponseWriter, request *http.Request) {
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
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.TipRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("targetType", body.TargetType, "post", "clip", "live", "profile")
		collector.RequireLength("targetId", body.TargetId, 1, 80)
		collector.RequireRange("coins", body.Coins, 1, services.MaximumTipCoins)
		if utf8.RuneCountInString(services.NormalizeTipNote(body.Note)) > services.MaximumTipNoteRunes {
			collector.Add("note", "must be at most 280 characters")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	receipt, err := controller.Money.SendTip(request.Context(), services.TipRequest{
		SenderId: principal.UserId, TargetType: body.TargetType, TargetId: body.TargetId, Coins: body.Coins, Note: services.NormalizeTipNote(body.Note), IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, receipt, receipt.Replayed)
}

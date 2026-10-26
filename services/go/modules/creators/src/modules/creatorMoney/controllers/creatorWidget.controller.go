package controllers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"nantty/modules/creators/src/modules/creatorMoney/services"
	"nantty/modules/creators/src/repositories"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/widgets"
)

type CreatorTodayWidgetPayload struct {
	CreatorProgramMember bool            `json:"creatorProgramMember"`
	ViewsToday           int64           `json:"viewsToday"`
	NewFollowersToday    int64           `json:"newFollowersToday"`
	EarningsToday        *services.Money `json:"earningsToday"`
	AmountsHidden        bool            `json:"amountsHidden"`
	DeepLink             string          `json:"deepLink"`
	GeneratedAt          string          `json:"generatedAt"`
}

type CreatorWidgetController struct {
	Money services.CreatorMoney
	cache *widgets.ResponseCache[CreatorTodayWidgetPayload]
}

func NewCreatorWidgetController(money services.CreatorMoney) CreatorWidgetController {
	return CreatorWidgetController{Money: money, cache: widgets.NewResponseCache[CreatorTodayWidgetPayload](widgets.DefaultCacheTimeToLive, widgets.DefaultCacheEntries, money.Container.Now)}
}

func (controller CreatorWidgetController) CreatorToday(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Money.Container.Resources.Logger, err)
		return
	}
	hidden := widgets.AmountsHidden(request)
	currency := request.URL.Query().Get("currency")
	cacheKey := principal.UserId + "|" + currency + "|" + map[bool]string{true: "hidden", false: "shown"}[hidden]
	payload, err := controller.cache.GetOrLoad(request.Context(), cacheKey, func(ctx context.Context) (CreatorTodayWidgetPayload, error) {
		return controller.buildCreatorToday(ctx, principal.UserId, currency, hidden)
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Money.Container.Resources.Logger, err)
		return
	}
	widgets.WriteWidgetJson(writer, payload)
}

func (controller CreatorWidgetController) buildCreatorToday(ctx context.Context, creatorId, currency string, hidden bool) (CreatorTodayWidgetPayload, error) {
	now := controller.Money.Container.Now().UTC()
	payload := CreatorTodayWidgetPayload{AmountsHidden: hidden, DeepLink: "zudomart://creator/dashboard", GeneratedAt: now.Format(time.RFC3339)}
	dashboard, err := controller.Money.BuildDashboard(ctx, creatorId, "today", currency)
	if errors.Is(err, services.ErrCreatorProgramOnly) {
		payload.DeepLink = "zudomart://creator"
		return payload, nil
	}
	if err != nil {
		return payload, err
	}
	payload.CreatorProgramMember = true
	if !hidden {
		earnings := dashboard.Earnings.Total
		payload.EarningsToday = &earnings
	}
	stats, supported := controller.Money.Container.Directory.(repositories.CreatorWidgetStatsReader)
	if !supported {
		return payload, nil
	}
	if payload.NewFollowersToday, err = stats.FollowersGainedSince(ctx, creatorId, *services.PeriodStart("today", now)); err != nil {
		return payload, err
	}
	payload.ViewsToday, err = stats.ContentViewsOnDay(ctx, creatorId, now.Format(time.DateOnly))
	return payload, err
}

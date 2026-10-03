package httpapi

import (
	"net/http"
	"slices"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
	"zudomart/platform/httpserver"
)

func (routes LiveRoutes) getMyLivePoints(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		points, err := routes.Application.GetMyLivePoints(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, points)
		}
		return err
	})
}

func (routes LiveRoutes) awardEngagement(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidateEngagementRequest)
		if err != nil {
			return err
		}
		award, err := routes.Application.AwardEngagementPoints(request.Context(), actor, liveId, body.Action)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, award)
		}
		return err
	})
}

func (routes LiveRoutes) getRankings(writer http.ResponseWriter, request *http.Request) {
	query, err := readRankingQuery(request)
	if err == nil {
		var rankings application.RankingsView
		if rankings, err = routes.Application.GetRankings(request.Context(), query); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, rankings)
			return
		}
	}
	routes.respondWithError(writer, request, err)
}

func readRankingQuery(request *http.Request) (application.RankingQuery, error) {
	values := request.URL.Query()
	query := application.RankingQuery{
		Board: values.Get("board"), Scope: orDefault(values.Get("scope"), "global"), Period: orDefault(values.Get("period"), "all"),
		CountryCode: values.Get("countryCode"), CategoryId: values.Get("categoryId"), Limit: 20,
	}
	var collected issues
	if !slices.Contains(rankingBoards, query.Board) {
		collected.add("board", "must be one of streamer, supporter, creator, engagement")
	}
	if !slices.Contains(rankingScopes, query.Scope) {
		collected.add("scope", "must be global, country or category")
	}
	if !slices.Contains(rankingPeriods, query.Period) {
		collected.add("period", "must be day, week, month or all")
	}
	if query.Scope == "country" && len(query.CountryCode) != 2 {
		collected.add("countryCode", "is required for scope=country")
	}
	if query.Scope == "category" && query.CategoryId == "" {
		collected.add("categoryId", "is required for scope=category")
	}
	if raw := values.Get("cursor"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			collected.add("cursor", "is invalid")
		}
		query.Cursor = parsed
	}
	return query, collected.asError()
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func (routes LiveRoutes) listAllGifts(writer http.ResponseWriter, request *http.Request) {
	gifts, err := routes.Application.ListGiftCatalog(request.Context(), true)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(gifts, ""))
}

func toGiftInput(body giftRequest, identifier string) application.GiftInput {
	return application.GiftInput{
		Id: identifier, Name: body.Name, Description: body.Description, Tier: body.Tier, PriceCoins: body.PriceCoins, AnimationEngine: body.AnimationEngine,
		AnimationAssetKey: body.AnimationAssetKey, PreviewAssetKey: body.PreviewAssetKey, DurationMs: body.DurationMs, DisplayLevel: body.DisplayLevel,
		Sound: body.Sound, Haptic: body.Haptic, Comboable: body.Comboable, IsActive: body.IsActive, SortOrder: body.SortOrder, Metadata: body.Metadata,
	}
}

func (routes LiveRoutes) createGift(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, func(body giftRequest) error { return ValidateGiftRequest(body, true) })
	if err == nil {
		var gift application.LiveGiftView
		if gift, err = routes.Application.CreateGift(request.Context(), toGiftInput(body, body.Id)); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, gift)
			return
		}
	}
	routes.respondWithError(writer, request, err)
}

func (routes LiveRoutes) updateGift(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, func(body giftRequest) error { return ValidateGiftRequest(body, false) })
	if err == nil {
		var gift application.LiveGiftView
		if gift, err = routes.Application.UpdateGift(request.Context(), toGiftInput(body, request.PathValue("giftId"))); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, gift)
			return
		}
	}
	routes.respondWithError(writer, request, err)
}

func (routes LiveRoutes) retireGift(writer http.ResponseWriter, request *http.Request) {
	if err := routes.Application.RetireGift(request.Context(), request.PathValue("giftId")); err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

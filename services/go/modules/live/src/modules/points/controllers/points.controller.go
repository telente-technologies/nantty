package controllers

import (
	"nantty/modules/live/src/container"
	awardengagementpoints "nantty/modules/live/src/modules/points/commands/awardEngagementPoints"
	getmylivepoints "nantty/modules/live/src/modules/points/queries/getMyLivePoints"
	getrankings "nantty/modules/live/src/modules/points/queries/getRankings"
	"nantty/modules/live/src/modules/points/validators"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
	"net/http"
	"slices"
	"strconv"

	"github.com/google/uuid"
)

type PointsController struct {
	Container *container.Container
}

func (controller PointsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller PointsController) GetMyLivePoints(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		points, err := (getmylivepoints.Handler{Container: controller.Container}).Execute(request.Context(), getmylivepoints.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, points)
		}
		return err
	})
}

func (controller PointsController) AwardEngagement(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateEngagementRequest)
		if err != nil {
			return err
		}
		award, err := (awardengagementpoints.Handler{Container: controller.Container}).Execute(request.Context(), awardengagementpoints.Command{Actor: actor, LiveId: liveId, Action: body.Action})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, award)
		}
		return err
	})
}

func (controller PointsController) GetRankings(writer http.ResponseWriter, request *http.Request) {
	query, err := readRankingQuery(request)
	if err == nil {
		var rankings types.RankingsView
		if rankings, err = (getrankings.Handler{Container: controller.Container}).Execute(request.Context(), getrankings.Query{Query: query}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, rankings)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func readRankingQuery(request *http.Request) (types.RankingQuery, error) {
	values := request.URL.Query()
	query := types.RankingQuery{
		Board: values.Get("board"), Scope: orDefault(values.Get("scope"), "global"), Period: orDefault(values.Get("period"), "all"),
		CountryCode: values.Get("countryCode"), CategoryId: values.Get("categoryId"), Limit: 20,
	}
	var collected utils.Issues
	if !slices.Contains(utils.RankingBoards, query.Board) {
		collected.Add("board", "must be one of streamer, supporter, creator, engagement")
	}
	if !slices.Contains(utils.RankingScopes, query.Scope) {
		collected.Add("scope", "must be global, country or category")
	}
	if !slices.Contains(utils.RankingPeriods, query.Period) {
		collected.Add("period", "must be day, week, month or all")
	}
	if query.Scope == "country" && len(query.CountryCode) != 2 {
		collected.Add("countryCode", "is required for scope=country")
	}
	if query.Scope == "category" && query.CategoryId == "" {
		collected.Add("categoryId", "is required for scope=category")
	}
	if raw := values.Get("cursor"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			collected.Add("cursor", "is invalid")
		}
		query.Cursor = parsed
	}
	return query, collected.AsError()
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

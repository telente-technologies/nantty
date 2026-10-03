package httpapi

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
)

func (routes LiveRoutes) createBattle(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidateCreateBattleRequest)
		if err != nil {
			return err
		}
		input := application.CreateBattleInput{DurationSeconds: body.DurationSeconds, WinnerTakesAll: body.WinnerTakesAll, IdempotencyKey: request.Header.Get("Idempotency-Key")}
		for _, participant := range body.ParticipantUserIds {
			input.ParticipantUserIds = append(input.ParticipantUserIds, uuid.MustParse(participant))
		}
		return routes.Application.CreateLiveBattle(request.Context(), actor, liveId, input)
	})
}

func (routes LiveRoutes) actOnBattle(writer http.ResponseWriter, request *http.Request) {
	actor, err := routes.actorFrom(request)
	var battleId uuid.UUID
	if err == nil {
		battleId, err = pathIdentifier(request, "battleId")
	}
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	liveId, err := routes.runBattleAction(request, actor, battleId, request.PathValue("action"))
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	routes.respondWithStage(writer, request, actor, liveId, nil)
}

func (routes LiveRoutes) runBattleAction(request *http.Request, actor application.Actor, battleId uuid.UUID, action string) (uuid.UUID, error) {
	ctx := request.Context()
	switch action {
	case "accept":
		return routes.Application.RespondToWinnerTakesAllProposal(ctx, actor, battleId, true)
	case "decline":
		return routes.Application.RespondToWinnerTakesAllProposal(ctx, actor, battleId, false)
	case "cancel":
		return routes.Application.CancelPendingBattle(ctx, actor, battleId)
	case "start-without-winner-takes-all":
		return routes.Application.StartPendingBattleWithoutWinnerTakesAll(ctx, actor, battleId)
	case "end":
		return routes.Application.EndBattleEarlyAsHost(ctx, actor, battleId)
	}
	return uuid.Nil, orNotFound(nil)
}

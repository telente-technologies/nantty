package controllers

import (
	"net/http"
	"zudomart/modules/live/src/container"
	cancelpendingbattle "zudomart/modules/live/src/modules/battles/commands/cancelPendingBattle"
	createlivebattle "zudomart/modules/live/src/modules/battles/commands/createLiveBattle"
	endbattleearlyashost "zudomart/modules/live/src/modules/battles/commands/endBattleEarlyAsHost"
	respondtowinnertakesallproposal "zudomart/modules/live/src/modules/battles/commands/respondToWinnerTakesAllProposal"
	startpendingbattlewithoutwinnertakesall "zudomart/modules/live/src/modules/battles/commands/startPendingBattleWithoutWinnerTakesAll"
	getbattle "zudomart/modules/live/src/modules/battles/queries/getBattle"
	"zudomart/modules/live/src/modules/battles/validators"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"

	"github.com/google/uuid"
)

type BattlesController struct {
	Container *container.Container
}

func (controller BattlesController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller BattlesController) CreateBattle(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateCreateBattleRequest)
		if err != nil {
			return err
		}
		input := types.CreateBattleInput{DurationSeconds: body.DurationSeconds, WinnerTakesAll: body.WinnerTakesAll, IdempotencyKey: request.Header.Get("Idempotency-Key")}
		for _, participant := range body.ParticipantUserIds {
			input.ParticipantUserIds = append(input.ParticipantUserIds, uuid.MustParse(participant))
		}
		return (createlivebattle.Handler{Container: controller.Container}).Execute(request.Context(), createlivebattle.Command{Actor: actor, LiveId: liveId, Input: input})
	})
}

func (controller BattlesController) GetBattle(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	var battleId uuid.UUID
	if err == nil {
		battleId, err = utils.PathIdentifier(request, "battleId")
	}
	var view types.BattleView
	if err == nil {
		view, err = (getbattle.Handler{Container: controller.Container}).Execute(request.Context(), getbattle.Query{Viewer: actor.UserId, BattleId: battleId})
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BattlesController) ActOnBattle(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	var battleId uuid.UUID
	if err == nil {
		battleId, err = utils.PathIdentifier(request, "battleId")
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	liveId, err := controller.runBattleAction(request, actor, battleId, request.PathValue("action"))
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	utils.RespondWithStage(controller.Container, writer, request, actor, liveId, nil)
}

func (controller BattlesController) runBattleAction(request *http.Request, actor types.Actor, battleId uuid.UUID, action string) (uuid.UUID, error) {
	ctx := request.Context()
	switch action {
	case "accept":
		return (respondtowinnertakesallproposal.Handler{Container: controller.Container}).Execute(ctx, respondtowinnertakesallproposal.Command{Actor: actor, BattleId: battleId, Accept: true})
	case "decline":
		return (respondtowinnertakesallproposal.Handler{Container: controller.Container}).Execute(ctx, respondtowinnertakesallproposal.Command{Actor: actor, BattleId: battleId, Accept: false})
	case "cancel":
		return (cancelpendingbattle.Handler{Container: controller.Container}).Execute(ctx, cancelpendingbattle.Command{Actor: actor, BattleId: battleId})
	case "start-without-winner-takes-all":
		return (startpendingbattlewithoutwinnertakesall.Handler{Container: controller.Container}).Execute(ctx, startpendingbattlewithoutwinnertakesall.Command{Actor: actor, BattleId: battleId})
	case "end":
		return (endbattleearlyashost.Handler{Container: controller.Container}).Execute(ctx, endbattleearlyashost.Command{Actor: actor, BattleId: battleId})
	}
	return uuid.Nil, utils.OrNotFound(nil)
}

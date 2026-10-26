package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"nantty/modules/live/src/container"
	cancelgiftgoal "nantty/modules/live/src/modules/gifts/commands/cancelGiftGoal"
	creategift "nantty/modules/live/src/modules/gifts/commands/createGift"
	creategiftgoal "nantty/modules/live/src/modules/gifts/commands/createGiftGoal"
	retiregift "nantty/modules/live/src/modules/gifts/commands/retireGift"
	sendgifttolive "nantty/modules/live/src/modules/gifts/commands/sendGiftToLive"
	updategift "nantty/modules/live/src/modules/gifts/commands/updateGift"
	updategiftgoal "nantty/modules/live/src/modules/gifts/commands/updateGiftGoal"
	"nantty/modules/live/src/modules/gifts/dtos"
	getlivegiftstreamstats "nantty/modules/live/src/modules/gifts/queries/getLiveGiftStreamStats"
	getliveleaderboard "nantty/modules/live/src/modules/gifts/queries/getLiveLeaderboard"
	listgiftcatalog "nantty/modules/live/src/modules/gifts/queries/listGiftCatalog"
	listgiftgoals "nantty/modules/live/src/modules/gifts/queries/listGiftGoals"
	"nantty/modules/live/src/modules/gifts/validators"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
	"net/http"
	"strconv"

	"github.com/google/uuid"
)

type GiftsController struct {
	Container *container.Container
}

func (controller GiftsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller GiftsController) ListGiftCatalog(writer http.ResponseWriter, request *http.Request) {
	gifts, err := (listgiftcatalog.Handler{Container: controller.Container}).Execute(request.Context(), listgiftcatalog.Query{IncludeInactive: false})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	encoded, _ := json.Marshal(gifts)
	digest := sha256.Sum256(encoded)
	etag := `"` + hex.EncodeToString(digest[:8]) + `"`
	writer.Header().Set("ETag", etag)
	writer.Header().Set("Cache-Control", "private, max-age=60")
	if request.Header.Get("If-None-Match") == etag {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(gifts, ""))
}

func (controller GiftsController) SendGift(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateSendGiftRequest)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	controller.deliverGift(writer, request, actor, uuid.MustParse(body.LiveId), body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)
}

func (controller GiftsController) SendGiftToPathLive(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidatePathSendGiftRequest)
		if err != nil {
			return err
		}
		controller.deliverGift(writer, request, actor, liveId, body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)
		return nil
	})
}

func (controller GiftsController) deliverGift(writer http.ResponseWriter, request *http.Request, actor types.Actor, liveId uuid.UUID, giftId string, quantity int, receiver, comboId string) {
	input := types.SendGiftInput{LiveId: liveId, GiftId: giftId, Quantity: quantity, ComboId: comboId, IdempotencyKey: request.Header.Get("Idempotency-Key")}
	if receiver != "" {
		receiverId := uuid.MustParse(receiver)
		input.ReceiverUserId = &receiverId
	}
	receipt, err := (sendgifttolive.Handler{Container: controller.Container}).Execute(request.Context(), sendgifttolive.Command{Actor: actor, Input: input})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, receipt)
}

func (controller GiftsController) GetLeaderboard(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		query := request.URL.Query()
		limit := 20
		if raw := query.Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > 100 {
				return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "limit", Message: "must be 1-100"}})
			}
			limit = parsed
		}
		var receiver *uuid.UUID
		if query.Get("scope") == "recipient" {
			parsed, err := uuid.Parse(query.Get("receiverUserId"))
			if err != nil {
				return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "receiverUserId", Message: "is required for scope=recipient"}})
			}
			receiver = &parsed
		}
		board, err := (getliveleaderboard.Handler{Container: controller.Container}).Execute(request.Context(), getliveleaderboard.Query{LiveId: liveId, Viewer: actor.UserId, Receiver: receiver, Limit: limit})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, board)
		}
		return err
	})
}

func (controller GiftsController) GetStreamStats(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		stats, err := (getlivegiftstreamstats.Handler{Container: controller.Container}).Execute(request.Context(), getlivegiftstreamstats.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, stats)
		}
		return err
	})
}

func (controller GiftsController) ListGiftGoals(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(_ types.Actor, liveId uuid.UUID) error {
		goals, err := (listgiftgoals.Handler{Container: controller.Container}).Execute(request.Context(), listgiftgoals.Query{LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(goals, ""))
		}
		return err
	})
}

func (controller GiftsController) CreateGiftGoal(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, func(body dtos.GiftGoalRequest) error { return validators.ValidateGiftGoalRequest(body, true) })
		if err != nil {
			return err
		}
		goal, err := (creategiftgoal.Handler{Container: controller.Container}).Execute(request.Context(), creategiftgoal.Command{Actor: actor, LiveId: liveId, Input: types.GiftGoalInput{Title: body.Title, TargetCoins: body.TargetCoins, GiftId: body.GiftId.Value, GiftIdPresent: body.GiftId.Present}})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, goal)
		}
		return err
	})
}

func (controller GiftsController) UpdateGiftGoal(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		goalId, err := utils.PathIdentifier(request, "goalId")
		if err != nil {
			return err
		}
		body, err := utils.DecodeAndValidate(writer, request, func(body dtos.GiftGoalRequest) error { return validators.ValidateGiftGoalRequest(body, false) })
		if err != nil {
			return err
		}
		goal, err := (updategiftgoal.Handler{Container: controller.Container}).Execute(request.Context(), updategiftgoal.Command{Actor: actor, LiveId: liveId, GoalId: goalId, Input: types.GiftGoalInput{Title: body.Title, TargetCoins: body.TargetCoins, GiftId: body.GiftId.Value, GiftIdPresent: body.GiftId.Present}})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, goal)
		}
		return err
	})
}

func (controller GiftsController) CancelGiftGoal(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		goalId, err := utils.PathIdentifier(request, "goalId")
		if err != nil {
			return err
		}
		if err := (cancelgiftgoal.Handler{Container: controller.Container}).Execute(request.Context(), cancelgiftgoal.Command{Actor: actor, LiveId: liveId, GoalId: goalId}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller GiftsController) ListAllGifts(writer http.ResponseWriter, request *http.Request) {
	gifts, err := (listgiftcatalog.Handler{Container: controller.Container}).Execute(request.Context(), listgiftcatalog.Query{IncludeInactive: true})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(gifts, ""))
}

func toGiftInput(body dtos.GiftRequest, identifier string) types.GiftInput {
	return types.GiftInput{
		Id: identifier, Name: body.Name, Description: body.Description, Tier: body.Tier, PriceCoins: body.PriceCoins, AnimationEngine: body.AnimationEngine,
		AnimationAssetKey: body.AnimationAssetKey, PreviewAssetKey: body.PreviewAssetKey, DurationMs: body.DurationMs, DisplayLevel: body.DisplayLevel,
		Sound: body.Sound, Haptic: body.Haptic, Comboable: body.Comboable, IsActive: body.IsActive, SortOrder: body.SortOrder, Metadata: body.Metadata,
	}
}

func (controller GiftsController) CreateGift(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, func(body dtos.GiftRequest) error { return validators.ValidateGiftRequest(body, true) })
	if err == nil {
		var gift types.LiveGiftView
		if gift, err = (creategift.Handler{Container: controller.Container}).Execute(request.Context(), creategift.Command{Input: toGiftInput(body, body.Id)}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, gift)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller GiftsController) UpdateGift(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, func(body dtos.GiftRequest) error { return validators.ValidateGiftRequest(body, false) })
	if err == nil {
		var gift types.LiveGiftView
		if gift, err = (updategift.Handler{Container: controller.Container}).Execute(request.Context(), updategift.Command{Input: toGiftInput(body, request.PathValue("giftId"))}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, gift)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller GiftsController) RetireGift(writer http.ResponseWriter, request *http.Request) {
	if err := (retiregift.Handler{Container: controller.Container}).Execute(request.Context(), retiregift.Command{GiftId: request.PathValue("giftId")}); err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

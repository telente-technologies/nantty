package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
	"zudomart/platform/httpserver"
)

func (routes LiveRoutes) listGiftCatalog(writer http.ResponseWriter, request *http.Request) {
	gifts, err := routes.Application.ListGiftCatalog(request.Context(), false)
	if err != nil {
		routes.respondWithError(writer, request, err)
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

func (routes LiveRoutes) sendGift(writer http.ResponseWriter, request *http.Request) {
	actor, err := routes.actorFrom(request)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	body, err := decodeAndValidate(writer, request, ValidateSendGiftRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	routes.deliverGift(writer, request, actor, uuid.MustParse(body.LiveId), body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)
}

func (routes LiveRoutes) sendGiftToPathLive(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidatePathSendGiftRequest)
		if err != nil {
			return err
		}
		routes.deliverGift(writer, request, actor, liveId, body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)
		return nil
	})
}

func (routes LiveRoutes) deliverGift(writer http.ResponseWriter, request *http.Request, actor application.Actor, liveId uuid.UUID, giftId string, quantity int, receiver, comboId string) {
	input := application.SendGiftInput{LiveId: liveId, GiftId: giftId, Quantity: quantity, ComboId: comboId, IdempotencyKey: request.Header.Get("Idempotency-Key")}
	if receiver != "" {
		receiverId := uuid.MustParse(receiver)
		input.ReceiverUserId = &receiverId
	}
	receipt, err := routes.Application.SendGiftToLive(request.Context(), actor, input)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, receipt)
}

func (routes LiveRoutes) getLeaderboard(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
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
		board, err := routes.Application.GetLiveLeaderboard(request.Context(), liveId, actor.UserId, receiver, limit)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, board)
		}
		return err
	})
}

func (routes LiveRoutes) getStreamStats(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		stats, err := routes.Application.GetLiveGiftStreamStats(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, stats)
		}
		return err
	})
}

func (routes LiveRoutes) listGiftGoals(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(_ application.Actor, liveId uuid.UUID) error {
		goals, err := routes.Application.ListGiftGoals(request.Context(), liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(goals, ""))
		}
		return err
	})
}

func (routes LiveRoutes) createGiftGoal(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, func(body giftGoalRequest) error { return ValidateGiftGoalRequest(body, true) })
		if err != nil {
			return err
		}
		goal, err := routes.Application.CreateGiftGoal(request.Context(), actor, liveId, application.GiftGoalInput{Title: body.Title, TargetCoins: body.TargetCoins, GiftId: body.GiftId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, goal)
		}
		return err
	})
}

func (routes LiveRoutes) updateGiftGoal(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		goalId, err := pathIdentifier(request, "goalId")
		if err != nil {
			return err
		}
		body, err := decodeAndValidate(writer, request, func(body giftGoalRequest) error { return ValidateGiftGoalRequest(body, false) })
		if err != nil {
			return err
		}
		goal, err := routes.Application.UpdateGiftGoal(request.Context(), actor, liveId, goalId, application.GiftGoalInput{Title: body.Title, TargetCoins: body.TargetCoins})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, goal)
		}
		return err
	})
}

func (routes LiveRoutes) cancelGiftGoal(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		goalId, err := pathIdentifier(request, "goalId")
		if err != nil {
			return err
		}
		if err := routes.Application.CancelGiftGoal(request.Context(), actor, liveId, goalId); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

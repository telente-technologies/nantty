package controllers

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	cancellivesession "zudomart/modules/live/src/modules/sessions/commands/cancelLiveSession"
	updatelivedetails "zudomart/modules/live/src/modules/sessions/commands/updateLiveDetails"
	"zudomart/modules/live/src/modules/sessions/dtos"
	"zudomart/modules/live/src/modules/sessions/validators"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

func startNowFor(body dtos.CreateLiveRequest) bool {
	if body.StartNow != nil {
		return *body.StartNow
	}
	return body.ScheduledAt == nil
}

func scheduledAtFor(body dtos.CreateLiveRequest) *time.Time {
	if body.ScheduledAt == nil {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, *body.ScheduledAt)
	if err != nil {
		return nil
	}
	return &parsed
}

func (controller SessionsController) UpdateLiveDetails(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateUpdateLiveRequest)
		if err != nil {
			return err
		}
		scheduledAt, changeSchedule, err := validators.ReadScheduledAt(body.ScheduledAt)
		if err != nil {
			return err
		}
		input := types.UpdateLiveDetailsInput{Title: body.Title, Category: body.Category, ScheduledAt: scheduledAt, ChangeSchedule: changeSchedule}
		view, err := (updatelivedetails.Handler{Container: controller.Container}).Execute(request.Context(), updatelivedetails.Command{Actor: actor, LiveId: liveId, Input: input})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller SessionsController) CancelLiveSession(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		err := (cancellivesession.Handler{Container: controller.Container}).Execute(request.Context(), cancellivesession.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

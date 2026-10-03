package controllers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/livekit/protocol/webhook"

	"zudomart/modules/live/src/container"
	issuestreamkey "zudomart/modules/live/src/modules/studio/commands/issueStreamKey"
	recordegressoutcome "zudomart/modules/live/src/modules/studio/commands/recordEgressOutcome"
	revokestreamkey "zudomart/modules/live/src/modules/studio/commands/revokeStreamKey"
	setrecordingenabled "zudomart/modules/live/src/modules/studio/commands/setRecordingEnabled"
	getstreamkey "zudomart/modules/live/src/modules/studio/queries/getStreamKey"
	listliverecordings "zudomart/modules/live/src/modules/studio/queries/listLiveRecordings"
	listlivemy "zudomart/modules/live/src/modules/studio/queries/listMyLives"
	"zudomart/modules/live/src/modules/studio/validators"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

type StudioController struct {
	Container *container.Container
}

func (controller StudioController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller StudioController) ListMyLives(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err == nil {
		var cursor string
		var limit int
		if cursor, limit, err = utils.PageParameters(request, 20, 50); err == nil {
			var views []types.StudioLiveView
			var next string
			if views, next, err = (listlivemy.Handler{Container: controller.Container}).Execute(request.Context(), listlivemy.Query{Actor: actor, Cursor: cursor, Limit: limit}); err == nil {
				httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, next))
				return
			}
		}
	}
	controller.responder().Error(writer, request, err)
}

func writeSecretJson(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller StudioController) IssueStreamKey(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		protocol, err := validators.ReadIngressProtocol(request)
		if err != nil {
			return err
		}
		view, err := (issuestreamkey.Handler{Container: controller.Container}).Execute(request.Context(), issuestreamkey.Command{Actor: actor, LiveId: liveId, Protocol: protocol})
		if err == nil {
			writeSecretJson(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller StudioController) GetStreamKey(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		protocol, err := validators.ReadIngressProtocol(request)
		if err != nil {
			return err
		}
		view, err := (getstreamkey.Handler{Container: controller.Container}).Execute(request.Context(), getstreamkey.Query{Actor: actor, LiveId: liveId, Protocol: protocol})
		if err == nil {
			writeSecretJson(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller StudioController) RevokeStreamKey(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		protocol, err := validators.ReadIngressProtocol(request)
		if err != nil {
			return err
		}
		err = (revokestreamkey.Handler{Container: controller.Container}).Execute(request.Context(), revokestreamkey.Command{Actor: actor, LiveId: liveId, Protocol: protocol})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller StudioController) ListRecordings(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		views, err := (listliverecordings.Handler{Container: controller.Container}).Execute(request.Context(), listliverecordings.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			writeSecretJson(writer, http.StatusOK, httpserver.NewCursorPage(views, ""))
		}
		return err
	})
}

func (controller StudioController) SetRecording(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateRecordingSettingRequest)
		if err != nil {
			return err
		}
		view, err := (setrecordingenabled.Handler{Container: controller.Container}).Execute(request.Context(), setrecordingenabled.Command{Actor: actor, LiveId: liveId, Enabled: *body.Enabled})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller StudioController) ReceiveLiveKitWebhook(writer http.ResponseWriter, request *http.Request) {
	settings := controller.Container.Settings
	event, err := webhook.ReceiveWebhookEvent(request, auth.NewSimpleKeyProvider(settings.LiveKitApiKey, settings.LiveKitApiSecret))
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	if event.Event == webhook.EventEgressEnded && event.EgressInfo != nil {
		outcome := services.EgressOutcome{EgressId: event.EgressInfo.EgressId, Succeeded: event.EgressInfo.Status == livekit.EgressStatus_EGRESS_COMPLETE, FailureReason: event.EgressInfo.Error}
		if files := event.EgressInfo.FileResults; len(files) > 0 {
			outcome.DurationNanos, outcome.SizeBytes = files[0].Duration, files[0].Size
		}
		if err := (recordegressoutcome.Handler{Container: controller.Container}).Execute(request.Context(), recordegressoutcome.Command{Outcome: outcome}); err != nil {
			controller.responder().Error(writer, request, err)
			return
		}
	}
	httpserver.WriteNoContentResponse(writer)
}

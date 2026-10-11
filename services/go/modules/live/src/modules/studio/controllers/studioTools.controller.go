package controllers

import (
	"net/http"

	"github.com/google/uuid"

	deleteliverecording "zudomart/modules/live/src/modules/studio/commands/deleteLiveRecording"
	updatehostdefaults "zudomart/modules/live/src/modules/studio/commands/updateHostDefaults"
	gethostdefaults "zudomart/modules/live/src/modules/studio/queries/getHostDefaults"
	getstreamhealth "zudomart/modules/live/src/modules/studio/queries/getStreamHealth"
	"zudomart/modules/live/src/modules/studio/validators"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

func (controller StudioController) GetStreamHealth(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		view, err := (getstreamhealth.Handler{Container: controller.Container}).Execute(request.Context(), getstreamhealth.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			writeSecretJson(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller StudioController) DeleteRecording(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		recordingId, err := utils.PathIdentifier(request, "recordingId")
		if err != nil {
			return err
		}
		command := deleteliverecording.Command{Actor: actor, LiveId: liveId, RecordingId: recordingId}
		if err = (deleteliverecording.Handler{Container: controller.Container}).Execute(request.Context(), command); err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller StudioController) GetHostDefaults(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err == nil {
		var view types.HostDefaultsView
		if view, err = (gethostdefaults.Handler{Container: controller.Container}).Execute(request.Context(), gethostdefaults.Query{Actor: actor}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller StudioController) UpdateHostDefaults(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err == nil {
		body, decodeErr := utils.DecodeAndValidate(writer, request, validators.ValidateHostDefaultsRequest)
		if err = decodeErr; err == nil {
			input := types.HostDefaultsInput{CommentsEnabled: body.CommentsEnabled, CommentAudience: body.CommentAudience, SlowModeSeconds: body.SlowModeSeconds, BlockedWords: body.BlockedWords}
			if body.ModeratorIds != nil {
				identifiers := make([]uuid.UUID, 0, len(*body.ModeratorIds))
				for _, raw := range *body.ModeratorIds {
					identifiers = append(identifiers, uuid.MustParse(raw))
				}
				input.ModeratorIds = &identifiers
			}
			var view types.HostDefaultsView
			if view, err = (updatehostdefaults.Handler{Container: controller.Container}).Execute(request.Context(), updatehostdefaults.Command{Actor: actor, Input: input}); err == nil {
				httpserver.WriteJsonResponse(writer, http.StatusOK, view)
				return
			}
		}
	}
	controller.responder().Error(writer, request, err)
}

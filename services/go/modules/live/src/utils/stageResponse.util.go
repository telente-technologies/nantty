package utils

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/live/src/container"
	getlivestage "nantty/modules/live/src/modules/stage/queries/getLiveStage"
	"nantty/modules/live/src/types"
	"nantty/platform/httpserver"
)

func RespondWithStage(deployed *container.Container, writer http.ResponseWriter, request *http.Request, actor types.Actor, liveId uuid.UUID, extra *types.MediaTokenView) {
	responder := Responder{Logger: deployed.Logger}
	stage, err := getlivestage.Handler{Container: deployed}.Execute(request.Context(), getlivestage.Query{LiveId: liveId, Viewer: &actor.UserId})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	if extra == nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, stage)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, struct {
		types.LiveStageView
		Livekit *types.MediaTokenView `json:"livekit"`
	}{stage, extra})
}

func RunStageCommand(deployed *container.Container, writer http.ResponseWriter, request *http.Request, command func(types.Actor, uuid.UUID) error) {
	responder := Responder{Logger: deployed.Logger}
	responder.WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		if err := command(actor, liveId); err != nil {
			return err
		}
		RespondWithStage(deployed, writer, request, actor, liveId, nil)
		return nil
	})
}

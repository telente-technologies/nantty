package controllers

import (
	"net/http"

	setrecordinglegalhold "zudomart/modules/live/src/modules/internalApi/commands/setRecordingLegalHold"
	setrecordingrepost "zudomart/modules/live/src/modules/internalApi/commands/setRecordingRepost"
	"zudomart/modules/live/src/modules/internalApi/dtos"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

func (controller InternalApiController) SetRecordingLegalHold(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "liveId")
	if err == nil {
		var body dtos.RecordingLegalHoldRequest
		if body, err = utils.DecodeAndValidate(writer, request, validateRecordingLegalHoldRequest); err == nil {
			var affected int
			command := setrecordinglegalhold.Command{LiveId: liveId, Held: *body.Held}
			if affected, err = (setrecordinglegalhold.Handler{Container: controller.Container}).Execute(request.Context(), command); err == nil {
				httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.RecordingLegalHoldView{LiveId: liveId.String(), Held: *body.Held, Recordings: affected})
				return
			}
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller InternalApiController) SetRecordingRepost(writer http.ResponseWriter, request *http.Request) {
	recordingId, err := utils.PathIdentifier(request, "recordingId")
	if err == nil {
		var body dtos.RecordingRepostRequest
		if body, err = utils.DecodeAndValidate(writer, request, validateRecordingRepostRequest); err == nil {
			postId := ""
			if body.PostId != nil {
				postId = *body.PostId
			}
			if err = (setrecordingrepost.Handler{Container: controller.Container}).Execute(request.Context(), setrecordingrepost.Command{RecordingId: recordingId, PostId: postId}); err == nil {
				httpserver.WriteNoContentResponse(writer)
				return
			}
		}
	}
	controller.responder().Error(writer, request, err)
}

func validateRecordingLegalHoldRequest(body dtos.RecordingLegalHoldRequest) error {
	var collected utils.Issues
	if body.Held == nil {
		collected.Add("held", "is required")
	}
	return collected.AsError()
}

func validateRecordingRepostRequest(body dtos.RecordingRepostRequest) error {
	var collected utils.Issues
	if body.PostId != nil && (len(*body.PostId) == 0 || len(*body.PostId) > 80) {
		collected.Add("postId", "must be a post id of at most 80 characters, or null to clear the repost")
	}
	return collected.AsError()
}

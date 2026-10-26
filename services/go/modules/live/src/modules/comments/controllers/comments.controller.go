package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent/liverestriction"
	deletelivecomment "nantty/modules/live/src/modules/comments/commands/deleteLiveComment"
	grantlivemoderator "nantty/modules/live/src/modules/comments/commands/grantLiveModerator"
	imposeviewerrestriction "nantty/modules/live/src/modules/comments/commands/imposeViewerRestriction"
	liftviewerrestriction "nantty/modules/live/src/modules/comments/commands/liftViewerRestriction"
	pinlivecomment "nantty/modules/live/src/modules/comments/commands/pinLiveComment"
	postlivecomment "nantty/modules/live/src/modules/comments/commands/postLiveComment"
	revokelivemoderator "nantty/modules/live/src/modules/comments/commands/revokeLiveModerator"
	unpinlivecomment "nantty/modules/live/src/modules/comments/commands/unpinLiveComment"
	updateroomsettings "nantty/modules/live/src/modules/comments/commands/updateRoomSettings"
	"nantty/modules/live/src/modules/comments/dtos"
	getroomsettings "nantty/modules/live/src/modules/comments/queries/getRoomSettings"
	listlivecomments "nantty/modules/live/src/modules/comments/queries/listLiveComments"
	listlivemoderators "nantty/modules/live/src/modules/comments/queries/listLiveModerators"
	"nantty/modules/live/src/modules/comments/validators"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

type CommentsController struct {
	Container *container.Container
}

func (controller CommentsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller CommentsController) PostComment(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidatePostCommentRequest)
		if err != nil {
			return err
		}
		input := types.PostLiveCommentInput{Text: body.Text, Mentions: body.Mentions, ReplyToId: body.ReplyToId}
		view, err := (postlivecomment.Handler{Container: controller.Container}).Execute(request.Context(), postlivecomment.Command{Actor: actor, LiveId: liveId, Input: input})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
		}
		return err
	})
}

func (controller CommentsController) ListComments(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		cursor, limit, err := utils.PageParameters(request, 30, 100)
		if err != nil {
			return err
		}
		order := request.URL.Query().Get("order")
		if order != "" && order != "oldest" && order != "newest" {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "order", Message: "must be oldest or newest"}})
		}
		views, next, err := (listlivecomments.Handler{Container: controller.Container}).Execute(request.Context(), listlivecomments.Query{Actor: actor, LiveId: liveId, Cursor: cursor, Limit: limit, OldestFirst: order != "newest"})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, next))
		}
		return err
	})
}

func (controller CommentsController) DeleteComment(writer http.ResponseWriter, request *http.Request) {
	controller.withCommentId(writer, request, func(actor types.Actor, liveId, commentId uuid.UUID) error {
		err := (deletelivecomment.Handler{Container: controller.Container}).Execute(request.Context(), deletelivecomment.Command{Actor: actor, LiveId: liveId, CommentId: commentId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller CommentsController) PinComment(writer http.ResponseWriter, request *http.Request) {
	controller.withCommentId(writer, request, func(actor types.Actor, liveId, commentId uuid.UUID) error {
		view, err := (pinlivecomment.Handler{Container: controller.Container}).Execute(request.Context(), pinlivecomment.Command{Actor: actor, LiveId: liveId, CommentId: commentId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller CommentsController) UnpinComment(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		err := (unpinlivecomment.Handler{Container: controller.Container}).Execute(request.Context(), unpinlivecomment.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller CommentsController) withCommentId(writer http.ResponseWriter, request *http.Request, run func(types.Actor, uuid.UUID, uuid.UUID) error) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		commentId, err := utils.PathIdentifier(request, "commentId")
		if err != nil {
			return err
		}
		return run(actor, liveId, commentId)
	})
}

func (controller CommentsController) GetRoomSettings(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		view, err := (getroomsettings.Handler{Container: controller.Container}).Execute(request.Context(), getroomsettings.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller CommentsController) UpdateRoomSettings(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateRoomSettingsRequest)
		if err != nil {
			return err
		}
		input := types.RoomSettingsInput{CommentsEnabled: body.CommentsEnabled, SlowModeSeconds: body.SlowModeSeconds, BlockedWords: body.BlockedWords, CommentAudience: body.CommentAudience}
		view, err := (updateroomsettings.Handler{Container: controller.Container}).Execute(request.Context(), updateroomsettings.Command{Actor: actor, LiveId: liveId, Input: input})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller CommentsController) ListModerators(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		views, err := (listlivemoderators.Handler{Container: controller.Container}).Execute(request.Context(), listlivemoderators.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, ""))
		}
		return err
	})
}

func (controller CommentsController) withUserId(writer http.ResponseWriter, request *http.Request, run func(types.Actor, uuid.UUID, uuid.UUID) error) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		userId, err := utils.PathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		return run(actor, liveId, userId)
	})
}

func (controller CommentsController) GrantModerator(writer http.ResponseWriter, request *http.Request) {
	controller.withUserId(writer, request, func(actor types.Actor, liveId, userId uuid.UUID) error {
		err := (grantlivemoderator.Handler{Container: controller.Container}).Execute(request.Context(), grantlivemoderator.Command{Actor: actor, LiveId: liveId, UserId: userId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller CommentsController) RevokeModerator(writer http.ResponseWriter, request *http.Request) {
	controller.withUserId(writer, request, func(actor types.Actor, liveId, userId uuid.UUID) error {
		err := (revokelivemoderator.Handler{Container: controller.Container}).Execute(request.Context(), revokelivemoderator.Command{Actor: actor, LiveId: liveId, UserId: userId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller CommentsController) imposeRestriction(kind liverestriction.Kind, validate func(dtos.RestrictionRequest) error) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		controller.withUserId(writer, request, func(actor types.Actor, liveId, userId uuid.UUID) error {
			body, err := utils.DecodeOptionalBody(writer, request, validate)
			if err != nil {
				return err
			}
			input := services.RestrictionInput{Kind: kind, DurationMinutes: body.DurationMinutes, Reason: body.Reason}
			view, err := (imposeviewerrestriction.Handler{Container: controller.Container}).Execute(request.Context(), imposeviewerrestriction.Command{Actor: actor, LiveId: liveId, UserId: userId, Input: input})
			if err == nil {
				httpserver.WriteJsonResponse(writer, http.StatusOK, view)
			}
			return err
		})
	}
}

func (controller CommentsController) MuteViewer(writer http.ResponseWriter, request *http.Request) {
	controller.imposeRestriction(liverestriction.KindMuted, validators.ValidateMuteRequest)(writer, request)
}

func (controller CommentsController) BanViewer(writer http.ResponseWriter, request *http.Request) {
	controller.imposeRestriction(liverestriction.KindBanned, validators.ValidateBanRequest)(writer, request)
}

func (controller CommentsController) liftRestriction(kind liverestriction.Kind) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		controller.withUserId(writer, request, func(actor types.Actor, liveId, userId uuid.UUID) error {
			err := (liftviewerrestriction.Handler{Container: controller.Container}).Execute(request.Context(), liftviewerrestriction.Command{Actor: actor, LiveId: liveId, UserId: userId, Kind: kind})
			if err == nil {
				httpserver.WriteNoContentResponse(writer)
			}
			return err
		})
	}
}

func (controller CommentsController) UnmuteViewer(writer http.ResponseWriter, request *http.Request) {
	controller.liftRestriction(liverestriction.KindMuted)(writer, request)
}

func (controller CommentsController) UnbanViewer(writer http.ResponseWriter, request *http.Request) {
	controller.liftRestriction(liverestriction.KindBanned)(writer, request)
}

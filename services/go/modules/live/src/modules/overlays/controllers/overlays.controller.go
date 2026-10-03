package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/live/src/container"
	createoverlayscene "zudomart/modules/live/src/modules/overlays/commands/createOverlayScene"
	deleteoverlayscene "zudomart/modules/live/src/modules/overlays/commands/deleteOverlayScene"
	publishoverlayscene "zudomart/modules/live/src/modules/overlays/commands/publishOverlayScene"
	savemainoverlayscene "zudomart/modules/live/src/modules/overlays/commands/saveMainOverlayScene"
	unpublishoverlayscene "zudomart/modules/live/src/modules/overlays/commands/unpublishOverlayScene"
	updateoverlayscene "zudomart/modules/live/src/modules/overlays/commands/updateOverlayScene"
	"zudomart/modules/live/src/modules/overlays/dtos"
	getmainoverlayscene "zudomart/modules/live/src/modules/overlays/queries/getMainOverlayScene"
	getoverlayscene "zudomart/modules/live/src/modules/overlays/queries/getOverlayScene"
	getpublicoverlayscene "zudomart/modules/live/src/modules/overlays/queries/getPublicOverlayScene"
	listoverlayscenes "zudomart/modules/live/src/modules/overlays/queries/listOverlayScenes"
	"zudomart/modules/live/src/modules/overlays/validators"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

type OverlaysController struct {
	Container *container.Container
}

func (controller OverlaysController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func toInput(body dtos.OverlaySceneRequest) types.OverlaySceneInput {
	return types.OverlaySceneInput{Name: body.Name, Layers: body.Layers, Publish: body.Publish}
}

func (controller OverlaysController) withScene(writer http.ResponseWriter, request *http.Request, run func(types.Actor, uuid.UUID, string) error) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		return run(actor, liveId, request.PathValue("sceneId"))
	})
}

func (controller OverlaysController) respondWithScene(writer http.ResponseWriter, status int, view types.OverlaySceneView, err error) error {
	if err == nil {
		httpserver.WriteJsonResponse(writer, status, view)
	}
	return err
}

func (controller OverlaysController) ListScenes(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		views, err := (listoverlayscenes.Handler{Container: controller.Container}).Execute(request.Context(), listoverlayscenes.Query{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, ""))
		}
		return err
	})
}

func (controller OverlaysController) CreateScene(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateOverlaySceneRequest)
		if err != nil {
			return err
		}
		view, err := (createoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), createoverlayscene.Command{Actor: actor, LiveId: liveId, Input: toInput(body)})
		return controller.respondWithScene(writer, http.StatusCreated, view, err)
	})
}

func (controller OverlaysController) GetScene(writer http.ResponseWriter, request *http.Request) {
	controller.withScene(writer, request, func(actor types.Actor, liveId uuid.UUID, sceneId string) error {
		view, err := (getoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), getoverlayscene.Query{Actor: actor, LiveId: liveId, SceneId: sceneId})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) UpdateScene(writer http.ResponseWriter, request *http.Request) {
	controller.withScene(writer, request, func(actor types.Actor, liveId uuid.UUID, sceneId string) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateOverlaySceneRequest)
		if err != nil {
			return err
		}
		view, err := (updateoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), updateoverlayscene.Command{Actor: actor, LiveId: liveId, SceneId: sceneId, Input: toInput(body)})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) DeleteScene(writer http.ResponseWriter, request *http.Request) {
	controller.withScene(writer, request, func(actor types.Actor, liveId uuid.UUID, sceneId string) error {
		err := (deleteoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), deleteoverlayscene.Command{Actor: actor, LiveId: liveId, SceneId: sceneId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller OverlaysController) PublishScene(writer http.ResponseWriter, request *http.Request) {
	controller.withScene(writer, request, func(actor types.Actor, liveId uuid.UUID, sceneId string) error {
		view, err := (publishoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), publishoverlayscene.Command{Actor: actor, LiveId: liveId, SceneId: sceneId})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) UnpublishScene(writer http.ResponseWriter, request *http.Request) {
	controller.withScene(writer, request, func(actor types.Actor, liveId uuid.UUID, sceneId string) error {
		view, err := (unpublishoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), unpublishoverlayscene.Command{Actor: actor, LiveId: liveId, SceneId: sceneId})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) GetMainScene(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		view, err := (getmainoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), getmainoverlayscene.Query{Actor: actor, LiveId: liveId})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) SaveMainScene(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateOverlaySceneRequest)
		if err != nil {
			return err
		}
		view, err := (savemainoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), savemainoverlayscene.Command{Actor: actor, LiveId: liveId, Input: toInput(body)})
		return controller.respondWithScene(writer, http.StatusOK, view, err)
	})
}

func (controller OverlaysController) GetPublicScene(writer http.ResponseWriter, request *http.Request) {
	view, err := (getpublicoverlayscene.Handler{Container: controller.Container}).Execute(request.Context(), getpublicoverlayscene.Query{SceneId: request.PathValue("sceneId")})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "private, max-age=2")
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

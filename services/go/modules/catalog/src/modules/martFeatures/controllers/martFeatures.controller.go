package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	createfeature "zudomart/modules/catalog/src/modules/martFeatures/commands/createFeature"
	movefeature "zudomart/modules/catalog/src/modules/martFeatures/commands/moveFeature"
	setfeaturepublished "zudomart/modules/catalog/src/modules/martFeatures/commands/setFeaturePublished"
	updatefeature "zudomart/modules/catalog/src/modules/martFeatures/commands/updateFeature"
	"zudomart/modules/catalog/src/modules/martFeatures/dtos"
	getfeature "zudomart/modules/catalog/src/modules/martFeatures/queries/getFeature"
	getimagelibrary "zudomart/modules/catalog/src/modules/martFeatures/queries/getImageLibrary"
	listfeatures "zudomart/modules/catalog/src/modules/martFeatures/queries/listFeatures"
	listmarthighlights "zudomart/modules/catalog/src/modules/martFeatures/queries/listMartHighlights"
	"zudomart/modules/catalog/src/modules/martFeatures/validators"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type MartFeaturesController struct {
	Container *container.Container
}

func (controller MartFeaturesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller MartFeaturesController) List(writer http.ResponseWriter, request *http.Request) {
	result, err := (listfeatures.Handler{Container: controller.Container}).Execute(request.Context(), listfeatures.Query{})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller MartFeaturesController) ImageLibrary(writer http.ResponseWriter, request *http.Request) {
	result, err := (getimagelibrary.Handler{Container: controller.Container}).Execute(request.Context(), getimagelibrary.Query{})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller MartFeaturesController) Get(writer http.ResponseWriter, request *http.Request) {
	featureId, err := utils.PathIdentifier(request, "featureId")
	var result any
	if err == nil {
		result, err = (getfeature.Handler{Container: controller.Container}).Execute(request.Context(), getfeature.Query{FeatureId: featureId})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller MartFeaturesController) Create(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateFeatureReason)
	var result any
	if err == nil {
		result, err = (createfeature.Handler{Container: controller.Container}).Execute(request.Context(), createfeature.Command{Actor: services.StaffActorFrom(request), Request: body})
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller MartFeaturesController) Update(writer http.ResponseWriter, request *http.Request) {
	featureId, err := utils.PathIdentifier(request, "featureId")
	var body dtos.FeatureRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, validators.ValidateFeatureReason)
	}
	var result any
	if err == nil {
		result, err = (updatefeature.Handler{Container: controller.Container}).Execute(request.Context(), updatefeature.Command{Actor: services.StaffActorFrom(request), FeatureId: featureId, Request: body})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller MartFeaturesController) publication(published bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		featureId, err := utils.PathIdentifier(request, "featureId")
		var body dtos.ReasonRequest
		if err == nil {
			body, err = utils.DecodeAndValidate(writer, request, validators.ValidateReason)
		}
		var result any
		if err == nil {
			result, err = (setfeaturepublished.Handler{Container: controller.Container}).Execute(request.Context(), setfeaturepublished.Command{
				Actor: services.StaffActorFrom(request), FeatureId: featureId, Published: published, Reason: body.Reason,
			})
		}
		controller.respond(writer, request, http.StatusOK, result, err)
	}
}

func (controller MartFeaturesController) Publish(writer http.ResponseWriter, request *http.Request) {
	controller.publication(true)(writer, request)
}

func (controller MartFeaturesController) Unpublish(writer http.ResponseWriter, request *http.Request) {
	controller.publication(false)(writer, request)
}

func (controller MartFeaturesController) Move(writer http.ResponseWriter, request *http.Request) {
	featureId, err := utils.PathIdentifier(request, "featureId")
	var body dtos.MoveRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, validators.ValidateMove)
	}
	var result any
	if err == nil {
		result, err = (movefeature.Handler{Container: controller.Container}).Execute(request.Context(), movefeature.Command{Actor: services.StaffActorFrom(request), FeatureId: featureId, Direction: body.Direction})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller MartFeaturesController) Highlights(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 10, 20)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	var viewer *uuid.UUID
	if _, found := jwtauth.PrincipalFromContext(request.Context()); found {
		identifier := middlewares.AccountIdFrom(request.Context())
		viewer = &identifier
	}
	page, err := (listmarthighlights.Handler{Container: controller.Container}).Execute(request.Context(), listmarthighlights.Query{Viewer: viewer, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	writer.Header().Set("Cache-Control", "private, max-age=60")
	controller.respond(writer, request, http.StatusOK, page, err)
}

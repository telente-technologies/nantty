package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/middlewares"
	deletecustomersegment "zudomart/modules/orders/src/modules/customerSegments/commands/deleteCustomerSegment"
	savecustomersegment "zudomart/modules/orders/src/modules/customerSegments/commands/saveCustomerSegment"
	"zudomart/modules/orders/src/modules/customerSegments/dtos"
	listcustomersegments "zudomart/modules/orders/src/modules/customerSegments/queries/listCustomerSegments"
	"zudomart/modules/orders/src/modules/customerSegments/validators"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type CustomerSegmentsController struct {
	Container *container.Container
}

func (controller CustomerSegmentsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func customSegmentId(request *http.Request) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue("segmentId"))
	if err != nil {
		return uuid.Nil, ordererrors.SegmentNotFound
	}
	return identifier, nil
}

func (controller CustomerSegmentsController) List(writer http.ResponseWriter, request *http.Request) {
	page, err := listcustomersegments.Handler{Container: controller.Container}.Execute(request.Context(), listcustomersegments.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller CustomerSegmentsController) Create(writer http.ResponseWriter, request *http.Request) {
	input, err := utils.DecodeAndValidate[dtos.CustomerSegmentInput](writer, request, validators.ValidateSegmentInput)
	var view services.SegmentView
	if err == nil {
		changes := dtos.CustomerSegmentChanges{Name: &input.Name, Description: &input.Description, Rules: &input.Rules}
		view, err = savecustomersegment.Handler{Container: controller.Container}.Execute(request.Context(), savecustomersegment.Command{Store: middlewares.StoreAccessFrom(request.Context()), Changes: changes})
	}
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller CustomerSegmentsController) Update(writer http.ResponseWriter, request *http.Request) {
	segmentId, err := customSegmentId(request)
	var changes dtos.CustomerSegmentChanges
	if err == nil {
		changes, err = utils.DecodeAndValidate[dtos.CustomerSegmentChanges](writer, request, validators.ValidateSegmentChanges)
	}
	var view services.SegmentView
	if err == nil {
		view, err = savecustomersegment.Handler{Container: controller.Container}.Execute(request.Context(), savecustomersegment.Command{Store: middlewares.StoreAccessFrom(request.Context()), SegmentId: &segmentId, Changes: changes})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CustomerSegmentsController) Delete(writer http.ResponseWriter, request *http.Request) {
	segmentId, err := customSegmentId(request)
	if err == nil {
		err = deletecustomersegment.Handler{Container: controller.Container}.Execute(request.Context(), deletecustomersegment.Command{Store: middlewares.StoreAccessFrom(request.Context()), SegmentId: segmentId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

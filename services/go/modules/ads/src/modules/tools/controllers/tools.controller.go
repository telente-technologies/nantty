package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	createconversionevent "zudomart/modules/ads/src/modules/tools/commands/createConversionEvent"
	createexperiment "zudomart/modules/ads/src/modules/tools/commands/createExperiment"
	stopexperiment "zudomart/modules/ads/src/modules/tools/commands/stopExperiment"
	updateconversionevent "zudomart/modules/ads/src/modules/tools/commands/updateConversionEvent"
	"zudomart/modules/ads/src/modules/tools/dtos"
	listconversionevents "zudomart/modules/ads/src/modules/tools/queries/listConversionEvents"
	listexperiments "zudomart/modules/ads/src/modules/tools/queries/listExperiments"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type ToolsController struct{ Container *container.Container }

type pageRequest struct {
	user, account uuid.UUID
	cursor        *uuid.UUID
	limit         int
}

func (controller ToolsController) run(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		return work(user, account)
	})
}

func (controller ToolsController) page(writer http.ResponseWriter, request *http.Request, work func(page pageRequest) (any, error)) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		result, err := work(pageRequest{user: user, account: account, cursor: cursor, limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func respond[Body any](writer http.ResponseWriter, status int, body Body, err error) error {
	if err != nil {
		return err
	}
	httpserver.WriteJsonResponse(writer, status, body)
	return nil
}

func (controller ToolsController) ListConversionEvents(writer http.ResponseWriter, request *http.Request) {
	controller.page(writer, request, func(page pageRequest) (any, error) {
		items, next, err := (listconversionevents.Handler{Container: controller.Container}).Execute(request.Context(), listconversionevents.Query{AccountId: page.account, UserId: page.user, Cursor: page.cursor, Limit: page.limit})
		return httpserver.NewCursorPage(items, next), err
	})
}

func (controller ToolsController) CreateConversionEvent(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.ConversionEventInput
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (createconversionevent.Handler{Container: controller.Container}).Execute(request.Context(), createconversionevent.Command{AccountId: account, UserId: user, Input: body})
		return respond(writer, http.StatusCreated, created, err)
	})
}

func (controller ToolsController) UpdateConversionEvent(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.ConversionEventPatch
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		updated, err := (updateconversionevent.Handler{Container: controller.Container}).Execute(request.Context(), updateconversionevent.Command{AccountId: account, UserId: user, EventId: request.PathValue("eventId"), Patch: body})
		return respond(writer, http.StatusOK, updated, err)
	})
}

func (controller ToolsController) ListExperiments(writer http.ResponseWriter, request *http.Request) {
	controller.page(writer, request, func(page pageRequest) (any, error) {
		items, next, err := (listexperiments.Handler{Container: controller.Container}).Execute(request.Context(), listexperiments.Query{AccountId: page.account, UserId: page.user, Cursor: page.cursor, Limit: page.limit})
		return httpserver.NewCursorPage(items, next), err
	})
}

func (controller ToolsController) CreateExperiment(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.ExperimentInput
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (createexperiment.Handler{Container: controller.Container}).Execute(request.Context(), createexperiment.Command{AccountId: account, UserId: user, Input: body})
		return respond(writer, http.StatusCreated, created, err)
	})
}

func (controller ToolsController) StopExperiment(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		stopped, err := (stopexperiment.Handler{Container: controller.Container}).Execute(request.Context(), stopexperiment.Command{AccountId: account, UserId: user, ExperimentId: request.PathValue("experimentId")})
		return respond(writer, http.StatusOK, stopped, err)
	})
}

package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	createaudience "nantty/modules/ads/src/modules/audiences/commands/createAudience"
	deleteaudience "nantty/modules/ads/src/modules/audiences/commands/deleteAudience"
	renameaudience "nantty/modules/ads/src/modules/audiences/commands/renameAudience"
	uploadcustomerlist "nantty/modules/ads/src/modules/audiences/commands/uploadCustomerList"
	"nantty/modules/ads/src/modules/audiences/dtos"
	estimateaudience "nantty/modules/ads/src/modules/audiences/queries/estimateAudience"
	listaudiences "nantty/modules/ads/src/modules/audiences/queries/listAudiences"
	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

type AudiencesController struct{ Container *container.Container }

func (controller AudiencesController) run(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
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

func (controller AudiencesController) List(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		items, next, err := (listaudiences.Handler{Container: controller.Container}).Execute(request.Context(), listaudiences.Query{AccountId: account, UserId: user, Type: request.URL.Query().Get("type"), Cursor: cursor, Limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller AudiencesController) Create(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.CreateAudienceRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (createaudience.Handler{Container: controller.Container}).Execute(request.Context(), createaudience.Command{AccountId: account, UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, created)
		return nil
	})
}

func (controller AudiencesController) UploadCustomerList(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.CustomerListRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (uploadcustomerlist.Handler{Container: controller.Container}).Execute(request.Context(), uploadcustomerlist.Command{AccountId: account, UserId: user, IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, created)
		return nil
	})
}

func (controller AudiencesController) Rename(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		audience, err := utils.PathIdentifier(request, "audienceId")
		if err != nil {
			return err
		}
		var body dtos.RenameRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		renamed, err := (renameaudience.Handler{Container: controller.Container}).Execute(request.Context(), renameaudience.Command{AccountId: account, AudienceId: audience, UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, renamed)
		return nil
	})
}

func (controller AudiencesController) Delete(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		audience, err := utils.PathIdentifier(request, "audienceId")
		if err != nil {
			return err
		}
		if err := (deleteaudience.Handler{Container: controller.Container}).Execute(request.Context(), deleteaudience.Command{AccountId: account, AudienceId: audience, UserId: user}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller AudiencesController) Estimate(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.EstimateRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		estimate, err := (estimateaudience.Handler{Container: controller.Container}).Execute(request.Context(), estimateaudience.Query{AccountId: account, UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, estimate)
		return nil
	})
}

func (controller AudiencesController) Membership(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		var body struct {
			UserId string `json:"userId"`
		}
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		userId, err := uuid.Parse(body.UserId)
		if err != nil {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "userId", Message: "must be a valid id"}})
		}
		ids, err := services.AudienceIdsContaining(request.Context(), controller.Container.Client, userId)
		if err != nil {
			return err
		}
		if ids == nil {
			ids = []string{}
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"audienceIds": ids})
		return nil
	})
}

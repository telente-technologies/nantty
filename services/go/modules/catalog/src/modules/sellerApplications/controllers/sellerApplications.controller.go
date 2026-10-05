package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	decideapplication "zudomart/modules/catalog/src/modules/sellerApplications/commands/decideApplication"
	submitapplication "zudomart/modules/catalog/src/modules/sellerApplications/commands/submitApplication"
	"zudomart/modules/catalog/src/modules/sellerApplications/dtos"
	getapplication "zudomart/modules/catalog/src/modules/sellerApplications/queries/getApplication"
	getmyapplication "zudomart/modules/catalog/src/modules/sellerApplications/queries/getMyApplication"
	listapplications "zudomart/modules/catalog/src/modules/sellerApplications/queries/listApplications"
	"zudomart/modules/catalog/src/modules/sellerApplications/validators"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type SellerApplicationsController struct {
	Container *container.Container
}

func (controller SellerApplicationsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller SellerApplicationsController) Submit(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateSubmit)
	var result any
	if err == nil {
		result, err = (submitapplication.Handler{Container: controller.Container}).Execute(request.Context(), submitapplication.Command{
			AccountId: middlewares.AccountIdFrom(request.Context()), IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body,
		})
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller SellerApplicationsController) Mine(writer http.ResponseWriter, request *http.Request) {
	result, err := (getmyapplication.Handler{Container: controller.Container}).Execute(request.Context(), getmyapplication.Query{AccountId: middlewares.AccountIdFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller SellerApplicationsController) List(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	var result any
	if err == nil {
		query := request.URL.Query()
		result, err = (listapplications.Handler{Container: controller.Container}).Execute(request.Context(), listapplications.Query{
			Status: query.Get("status"), Search: query.Get("search"), Cursor: query.Get("cursor"), Limit: limit,
		})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller SellerApplicationsController) Get(writer http.ResponseWriter, request *http.Request) {
	applicationId, err := utils.PathIdentifier(request, "applicationId")
	var result any
	if err == nil {
		result, err = (getapplication.Handler{Container: controller.Container}).Execute(request.Context(), getapplication.Query{ApplicationId: applicationId})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller SellerApplicationsController) Decide(approve bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		applicationId, err := utils.PathIdentifier(request, "applicationId")
		var body dtos.DecisionRequest
		if err == nil {
			body, err = utils.DecodeAndValidate(writer, request, validators.ValidateDecision)
		}
		if err == nil {
			err = (decideapplication.Handler{Container: controller.Container}).Execute(request.Context(), decideapplication.Command{
				Actor: services.StaffActorFrom(request), ApplicationId: applicationId, Approve: approve, Reason: body.Reason,
			})
		}
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.Get(writer, request)
	}
}

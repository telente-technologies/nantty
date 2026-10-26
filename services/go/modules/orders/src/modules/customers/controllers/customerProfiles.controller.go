package controllers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"

	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/middlewares"
	savecustomerprofile "nantty/modules/orders/src/modules/customers/commands/saveCustomerProfile"
	"nantty/modules/orders/src/modules/customers/dtos"
	"nantty/modules/orders/src/modules/customers/validators"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type customerExistsBody struct {
	Message  string                `json:"message"`
	Code     string                `json:"code"`
	Customer services.CustomerView `json:"customer"`
}

func (controller CustomersController) saveProfile(writer http.ResponseWriter, request *http.Request, customerId *uuid.UUID, status int, validate func(dtos.CustomerProfileInput) error) {
	input, err := utils.DecodeAndValidate[dtos.CustomerProfileInput](writer, request, validate)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	command := savecustomerprofile.Command{Store: middlewares.StoreAccessFrom(request.Context()), CustomerId: customerId, Input: input}
	customer, err := savecustomerprofile.Handler{Container: controller.Container}.Execute(request.Context(), command)
	var exists savecustomerprofile.CustomerExistsError
	if errors.As(err, &exists) {
		httpserver.WriteJsonResponse(writer, http.StatusConflict, customerExistsBody{Message: ordererrors.CustomerExists.Message, Code: ordererrors.CustomerExists.Code, Customer: exists.Customer})
		return
	}
	controller.respond(writer, request, status, customer, err)
}

func (controller CustomersController) Create(writer http.ResponseWriter, request *http.Request) {
	controller.saveProfile(writer, request, nil, http.StatusCreated, validators.ValidateNewCustomer)
}

func (controller CustomersController) Update(writer http.ResponseWriter, request *http.Request) {
	customerId, err := utils.PathIdentifier(request, "customerId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.saveProfile(writer, request, &customerId, http.StatusOK, validators.ValidateCustomerChanges)
}

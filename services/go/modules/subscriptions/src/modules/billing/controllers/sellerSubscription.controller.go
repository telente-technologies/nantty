package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/repositories"
	"nantty/platform/httpserver"
)

type referenceBody struct {
	Reference string `json:"reference"`
}

func (controller BillingController) sellerProfileId(request *http.Request, userId string) (string, error) {
	var storeId *uuid.UUID
	if parsed, err := uuid.Parse(request.Header.Get("X-Seller-Store")); err == nil {
		storeId = &parsed
	}
	container := controller.Billing.Container
	profileId, _, err := repositories.SellerStoreProfiles{Database: container.Resources.Database, CatalogSchema: container.Settings.CatalogSchema}.FindOwnedStoreProfile(request.Context(), userId, storeId)
	return profileId, err
}

func (controller BillingController) sellerContext(writer http.ResponseWriter, request *http.Request) (string, string, bool) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return "", "", false
	}
	profileId, err := controller.sellerProfileId(request, principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return "", "", false
	}
	return principal.UserId, profileId, true
}

func (controller BillingController) GetSellerSubscription(writer http.ResponseWriter, request *http.Request) {
	userId, profileId, ok := controller.sellerContext(writer, request)
	if !ok {
		return
	}
	details, err := controller.Billing.ReadSellerSubscriptionDetails(request.Context(), userId, profileId)
	controller.respond(writer, request, details, err)
}

func (controller BillingController) readReference(writer http.ResponseWriter, request *http.Request) (string, bool) {
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body referenceBody) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reference", strings.TrimSpace(body.Reference), 1, 120)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return "", false
	}
	return strings.TrimSpace(body.Reference), true
}

func (controller BillingController) VerifySellerSubscription(writer http.ResponseWriter, request *http.Request) {
	userId, _, ok := controller.sellerContext(writer, request)
	reference, valid := "", false
	if ok {
		reference, valid = controller.readReference(writer, request)
	}
	if !valid {
		return
	}
	details, err := controller.Billing.SellerDetailsForReference(request.Context(), userId, reference)
	controller.respond(writer, request, details, err)
}

func (controller BillingController) ChangeSellerSubscription(writer http.ResponseWriter, request *http.Request) {
	userId, profileId, ok := controller.sellerContext(writer, request)
	if !ok {
		return
	}
	action := request.PathValue("action")
	if action != "cancel" && action != "resume" {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusNotFound, "NOT_FOUND", "This endpoint is not available."))
		return
	}
	var err error
	if action == "resume" {
		err = controller.Billing.ResumeSellerSubscription(request.Context(), userId, profileId)
	} else {
		err = controller.Billing.CancelSellerSubscription(request.Context(), userId, profileId, false)
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	details, err := controller.Billing.ReadSellerSubscriptionDetails(request.Context(), userId, profileId)
	controller.respond(writer, request, details, err)
}

func (controller BillingController) VerifySellerTrial(writer http.ResponseWriter, request *http.Request) {
	userId, profileId, ok := controller.sellerContext(writer, request)
	reference, valid := "", false
	if ok {
		reference, valid = controller.readReference(writer, request)
	}
	if !valid {
		return
	}
	if _, err := controller.Billing.FindOwnedSubscriptionByReference(request.Context(), userId, reference); err != nil {
		controller.fail(writer, request, err)
		return
	}
	offer, err := controller.Billing.BuildOffer(request.Context(), userId, profileId)
	controller.respond(writer, request, offer, err)
}

func (controller BillingController) CancelSellerTrial(writer http.ResponseWriter, request *http.Request) {
	userId, profileId, ok := controller.sellerContext(writer, request)
	if !ok {
		return
	}
	if err := controller.Billing.CancelSellerSubscription(request.Context(), userId, profileId, true); err != nil {
		controller.fail(writer, request, err)
		return
	}
	offer, err := controller.Billing.BuildOffer(request.Context(), userId, profileId)
	controller.respond(writer, request, offer, err)
}

func (controller BillingController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

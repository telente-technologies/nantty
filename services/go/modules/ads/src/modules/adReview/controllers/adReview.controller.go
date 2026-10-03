package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	approvead "zudomart/modules/ads/src/modules/adReview/commands/approveAd"
	createpolicycategory "zudomart/modules/ads/src/modules/adReview/commands/createPolicyCategory"
	rejectad "zudomart/modules/ads/src/modules/adReview/commands/rejectAd"
	resolveadappeal "zudomart/modules/ads/src/modules/adReview/commands/resolveAdAppeal"
	setadvertisersuspension "zudomart/modules/ads/src/modules/adReview/commands/setAdvertiserSuspension"
	updatepolicycategory "zudomart/modules/ads/src/modules/adReview/commands/updatePolicyCategory"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	getadforreview "zudomart/modules/ads/src/modules/adReview/queries/getAdForReview"
	listadsforreview "zudomart/modules/ads/src/modules/adReview/queries/listAdsForReview"
	listadvertisers "zudomart/modules/ads/src/modules/adReview/queries/listAdvertisers"
	listpolicycategories "zudomart/modules/ads/src/modules/adReview/queries/listPolicyCategories"
	"zudomart/modules/ads/src/modules/adReview/services"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type AdReviewController struct{ Container *container.Container }

func (controller AdReviewController) run(writer http.ResponseWriter, request *http.Request, work func(reviewer services.Reviewer) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		return work(services.Reviewer{Name: middlewares.StaffName(principal.Roles)})
	})
}

func pageParameters(request *http.Request) (int, int) {
	page, _ := strconv.Atoi(request.URL.Query().Get("page"))
	size, _ := strconv.Atoi(request.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	return page, size
}

func (controller AdReviewController) ListAds(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		advertiser, err := optionalUuid(request, "advertiserId")
		if err != nil {
			return err
		}
		status := request.URL.Query().Get("status")
		if status == "" {
			status = "PENDING"
		}
		page, size := pageParameters(request)
		result, err := (listadsforreview.Handler{Container: controller.Container}).Execute(request.Context(), listadsforreview.Query{Status: status, AdvertiserId: advertiser, Search: request.URL.Query().Get("search"), Page: page, PageSize: size})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func optionalUuid(request *http.Request, name string) (*uuid.UUID, error) {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return &id, nil
}

func (controller AdReviewController) GetAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		result, err := (getadforreview.Handler{Container: controller.Container}).Execute(request.Context(), getadforreview.Query{AdId: adId})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) ApproveAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(reviewer services.Reviewer) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		var body dtos.ApproveRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		result, err := (approvead.Handler{Container: controller.Container}).Execute(request.Context(), approvead.Command{AdId: adId, Reviewer: reviewer, Reason: body.Reason, OverrideCriticalFlags: body.OverrideCriticalFlags})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) RejectAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(reviewer services.Reviewer) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		var body dtos.RejectRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := rejectad.Validate(body); err != nil {
			return err
		}
		result, err := (rejectad.Handler{Container: controller.Container}).Execute(request.Context(), rejectad.Command{AdId: adId, Reviewer: reviewer, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) ResolveAppeal(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(reviewer services.Reviewer) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		var body dtos.ResolveAppealRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := resolveadappeal.Validate(body); err != nil {
			return err
		}
		result, err := (resolveadappeal.Handler{Container: controller.Container}).Execute(request.Context(), resolveadappeal.Command{AdId: adId, Reviewer: reviewer, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) ListAdvertisers(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		page, size := pageParameters(request)
		result, err := (listadvertisers.Handler{Container: controller.Container}).Execute(request.Context(), listadvertisers.Query{Status: request.URL.Query().Get("status"), Search: request.URL.Query().Get("search"), Page: page, PageSize: size})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) setSuspension(writer http.ResponseWriter, request *http.Request, suspend bool) {
	controller.run(writer, request, func(services.Reviewer) error {
		accountId, err := utils.PathIdentifier(request, "advertiserId")
		if err != nil {
			return err
		}
		var body dtos.SuspensionRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := setadvertisersuspension.Validate(body.Reason); err != nil {
			return err
		}
		result, err := (setadvertisersuspension.Handler{Container: controller.Container}).Execute(request.Context(), setadvertisersuspension.Command{AccountId: accountId, Suspend: suspend, Reason: body.Reason})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdReviewController) SuspendAdvertiser(writer http.ResponseWriter, request *http.Request) {
	controller.setSuspension(writer, request, true)
}

func (controller AdReviewController) ReinstateAdvertiser(writer http.ResponseWriter, request *http.Request) {
	controller.setSuspension(writer, request, false)
}

func (controller AdReviewController) ListPolicies(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		items, err := (listpolicycategories.Handler{Container: controller.Container}).Execute(request.Context(), listpolicycategories.Query{})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
		return nil
	})
}

func (controller AdReviewController) CreatePolicy(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		var body dtos.PolicyCategoryRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		result, err := (createpolicycategory.Handler{Container: controller.Container}).Execute(request.Context(), createpolicycategory.Command{Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, result)
		return nil
	})
}

func (controller AdReviewController) UpdatePolicy(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(services.Reviewer) error {
		policyId, err := utils.PathIdentifier(request, "policyId")
		if err != nil {
			return err
		}
		var body dtos.PolicyCategoryRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		result, err := (updatepolicycategory.Handler{Container: controller.Container}).Execute(request.Context(), updatepolicycategory.Command{CategoryId: policyId, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

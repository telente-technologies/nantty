package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	removereviewreply "zudomart/modules/catalog/src/modules/reviews/commands/removeReviewReply"
	replytoreview "zudomart/modules/catalog/src/modules/reviews/commands/replyToReview"
	reportreview "zudomart/modules/catalog/src/modules/reviews/commands/reportReview"
	submitreview "zudomart/modules/catalog/src/modules/reviews/commands/submitReview"
	"zudomart/modules/catalog/src/modules/reviews/dtos"
	getratingsummary "zudomart/modules/catalog/src/modules/reviews/queries/getRatingSummary"
	getsellerreviewssummary "zudomart/modules/catalog/src/modules/reviews/queries/getSellerReviewsSummary"
	listpublicreviews "zudomart/modules/catalog/src/modules/reviews/queries/listPublicReviews"
	listsellerreviews "zudomart/modules/catalog/src/modules/reviews/queries/listSellerReviews"
	"zudomart/modules/catalog/src/modules/reviews/validators"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type ReviewsController struct {
	Container *container.Container
}

func (controller ReviewsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller ReviewsController) ListProductReviews(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	limit, limitError := utils.ReadPageLimit(request, 20, 50)
	if err == nil {
		err = limitError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listpublicreviews.Handler{Container: controller.Container}).Execute(request.Context(),
		listpublicreviews.Query{ProductId: &productId, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ReviewsController) ListStoreReviews(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	limit, limitError := utils.ReadPageLimit(request, 20, 50)
	if err == nil {
		err = limitError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listpublicreviews.Handler{Container: controller.Container}).Execute(request.Context(),
		listpublicreviews.Query{StoreId: &storeId, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ReviewsController) GetRatingSummary(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	summary, err := (getratingsummary.Handler{Container: controller.Container}).Execute(request.Context(), getratingsummary.Query{ProductId: productId})
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller ReviewsController) SubmitProductReview(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.submit(writer, request, &productId, nil)
}

func (controller ReviewsController) SubmitStoreReview(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.submit(writer, request, nil, &storeId)
}

func (controller ReviewsController) submit(writer http.ResponseWriter, request *http.Request, productId, storeId *uuid.UUID) {
	body, err := utils.DecodeAndValidate[dtos.SubmitReviewRequest](writer, request, validators.ValidateSubmitReview)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (submitreview.Handler{Container: controller.Container}).Execute(request.Context(),
		submitreview.Command{AccountId: middlewares.AccountIdFrom(request.Context()), ProductId: productId, StoreId: storeId, Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller ReviewsController) ListSellerReviews(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 10, 100)
	rating := 0
	if raw := request.URL.Query().Get("rating"); raw != "" && err == nil {
		if rating, err = strconv.Atoi(raw); err != nil || rating < 1 || rating > 5 {
			err = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "rating", Message: "must be 1 to 5"}})
		}
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := request.URL.Query()
	page, err := (listsellerreviews.Handler{Container: controller.Container}).Execute(request.Context(), listsellerreviews.Query{
		StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Kind: query.Get("kind"), Rating: rating, Replied: query.Get("replied"),
		Text: query.Get("q"), Sort: query.Get("sort"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ReviewsController) GetSellerSummary(writer http.ResponseWriter, request *http.Request) {
	summary, err := (getsellerreviewssummary.Handler{Container: controller.Container}).Execute(request.Context(),
		getsellerreviewssummary.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId})
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller ReviewsController) ReplyToReview(writer http.ResponseWriter, request *http.Request) {
	reviewId, err := utils.PathIdentifier(request, "reviewId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.ReplyRequest](writer, request, validators.ValidateReply)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (replytoreview.Handler{Container: controller.Container}).Execute(request.Context(), replytoreview.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), ReviewId: reviewId, ActorId: middlewares.AccountIdFrom(request.Context()), Body: body.Body,
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ReviewsController) RemoveReply(writer http.ResponseWriter, request *http.Request) {
	reviewId, err := utils.PathIdentifier(request, "reviewId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (removereviewreply.Handler{Container: controller.Container}).Execute(request.Context(),
		removereviewreply.Command{Store: middlewares.StoreAccessFrom(request.Context()), ReviewId: reviewId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ReviewsController) ReportReview(writer http.ResponseWriter, request *http.Request) {
	reviewId, err := utils.PathIdentifier(request, "reviewId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.ReportRequest](writer, request, validators.ValidateReport)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (reportreview.Handler{Container: controller.Container}).Execute(request.Context(),
		reportreview.Command{Store: middlewares.StoreAccessFrom(request.Context()), ReviewId: reviewId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

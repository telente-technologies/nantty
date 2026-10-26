package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/reviews/controllers"
)

func MountReviewsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ReviewsController{Container: deployed}
	signedIn := middlewares.Authenticated(deployed)
	manager := middlewares.StoreMember(deployed, "reviews:manage", false)
	mux.Handle("GET /api/v1/products/{productId}/reviews", http.HandlerFunc(controller.ListProductReviews))
	mux.Handle("GET /api/v1/products/{productId}/rating-summary", http.HandlerFunc(controller.GetRatingSummary))
	mux.Handle("POST /api/v1/products/{productId}/reviews", signedIn(controller.SubmitProductReview))
	mux.Handle("DELETE /api/v1/reviews/{reviewId}", signedIn(controller.DeleteOwnReview))
	mux.Handle("GET /api/v1/stores/{storeId}/reviews", http.HandlerFunc(controller.ListStoreReviews))
	mux.Handle("POST /api/v1/stores/{storeId}/reviews", signedIn(controller.SubmitStoreReview))
	mux.Handle("GET /api/v1/seller/reviews", manager(controller.ListSellerReviews))
	mux.Handle("GET /api/v1/seller/reviews/summary", manager(controller.GetSellerSummary))
	mux.Handle("PUT /api/v1/seller/reviews/{reviewId}/reply", manager(controller.ReplyToReview))
	mux.Handle("DELETE /api/v1/seller/reviews/{reviewId}/reply", manager(controller.RemoveReply))
	mux.Handle("POST /api/v1/seller/reviews/{reviewId}/report", manager(controller.ReportReview))
}

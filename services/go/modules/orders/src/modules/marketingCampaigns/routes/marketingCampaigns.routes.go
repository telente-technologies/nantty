package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/marketingCampaigns/controllers"
)

func MountMarketingCampaignsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MarketingCampaignsController{Container: deployed}
	manager := middlewares.StoreMemberFeature(deployed, "promotions:manage", "advanced_promotions", false)
	mux.Handle("GET /api/v1/seller/marketing/flash-sales", manager(controller.ListFlashSales))
	mux.Handle("POST /api/v1/seller/marketing/flash-sales", manager(controller.CreateFlashSale))
	mux.Handle("PATCH /api/v1/seller/marketing/flash-sales/{flashSaleId}", manager(controller.UpdateFlashSale))
	mux.Handle("DELETE /api/v1/seller/marketing/flash-sales/{flashSaleId}", manager(controller.DeleteFlashSale))
	mux.Handle("GET /api/v1/seller/marketing/bundles", manager(controller.ListBundles))
	mux.Handle("POST /api/v1/seller/marketing/bundles", manager(controller.CreateBundle))
	mux.Handle("PATCH /api/v1/seller/marketing/bundles/{bundleId}", manager(controller.UpdateBundle))
	mux.Handle("DELETE /api/v1/seller/marketing/bundles/{bundleId}", manager(controller.DeleteBundle))
}

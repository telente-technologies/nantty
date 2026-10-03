package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/sellerProducts/controllers"
)

func MountSellerProductsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerProductsController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "catalog:view", false)
	manager := middlewares.StoreMember(deployed, "products:manage", false)
	bulk := middlewares.StoreMemberFeature(deployed, "products:manage", "bulk_tools", false)
	bulkViewer := middlewares.StoreMemberFeature(deployed, "catalog:view", "bulk_tools", false)
	mux.Handle("GET /api/v1/seller/products", viewer(controller.ListProducts))
	mux.Handle("GET /api/v1/seller/products/usage", viewer(controller.GetUsage))
	mux.Handle("GET /api/v1/seller/products/export", bulkViewer(controller.ExportProducts))
	mux.Handle("POST /api/v1/seller/products", manager(controller.CreateProduct))
	mux.Handle("POST /api/v1/seller/products/bulk", bulk(controller.BulkAction))
	mux.Handle("POST /api/v1/seller/products/barcodes", manager(controller.GenerateBarcodes))
	mux.Handle("GET /api/v1/seller/products/{productId}", viewer(controller.GetProduct))
	mux.Handle("PATCH /api/v1/seller/products/{productId}", manager(controller.ReplaceProduct))
	mux.Handle("DELETE /api/v1/seller/products/{productId}", manager(controller.ArchiveProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/publish", manager(controller.PublishProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/unpublish", manager(controller.UnpublishProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/duplicate", manager(controller.DuplicateProduct))
}

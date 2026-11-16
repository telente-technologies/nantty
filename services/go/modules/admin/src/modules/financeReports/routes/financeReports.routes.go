package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/financeReports/controllers"
)

func MountFinanceReportsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.FinanceReportsController{Container: container}
	read := container.Guard.RequireStaff("finance:reports", false)
	exportGuard := container.Guard.RequireStaff("finance:reports", true)
	mux.Handle("GET /api/v1/admin/finance/overview", read(http.HandlerFunc(controller.Overview)))
	mux.Handle("GET /api/v1/admin/finance/money-by-aspect", read(http.HandlerFunc(controller.MoneyByAspect)))
	mux.Handle("GET /api/v1/admin/finance/escrow-held", read(http.HandlerFunc(controller.EscrowHeld)))
	mux.Handle("GET /api/v1/admin/finance/stuck-escrows", read(http.HandlerFunc(controller.StuckEscrows)))
	mux.Handle("GET /api/v1/admin/finance/issues", read(http.HandlerFunc(controller.Issues)))
	mux.Handle("GET /api/v1/admin/finance/lookup", read(http.HandlerFunc(controller.Lookup)))
	mux.Handle("GET /api/v1/admin/finance/reports", read(http.HandlerFunc(controller.Reports)))
	mux.Handle("POST /api/v1/admin/finance/reports/export", exportGuard(http.HandlerFunc(controller.Export)))
}

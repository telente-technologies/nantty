package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/ledger/src/modules/journal/controllers"
)

func MountJournalRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.JournalController{Container: container}
	staff := container.Resources.StaffVerifiers
	requireRead := middlewares.RequireStaffPermission(staff, constants.PermissionReadLedger, false)
	requireReverse := middlewares.RequireStaffPermission(staff, constants.PermissionReverseJournalEntry, true)
	mux.Handle("GET /api/v1/admin/ledger/integrity", requireRead(http.HandlerFunc(controller.GetLedgerIntegrityReport)))
	mux.Handle("GET /api/v1/admin/ledger/statement", requireRead(http.HandlerFunc(controller.GetAccountStatement)))
	mux.Handle("POST /api/v1/admin/ledger/journal-entries/{entryId}/reversal", requireReverse(http.HandlerFunc(controller.ReverseJournalEntry)))
}

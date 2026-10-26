package routes

import (
	"net/http"

	"nantty/modules/ledger/src/constants"
	"nantty/modules/ledger/src/container"
	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/ledger/src/modules/journal/controllers"
)

func MountJournalRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.JournalController{Container: container}
	staff := container.Resources.StaffVerifiers
	requireRead := middlewares.RequireStaffPermission(staff, constants.PermissionReadLedger, false)
	requireReverse := middlewares.RequireStaffPermissionWithSingleUseStepUp(staff, constants.PermissionReverseJournalEntry)
	mux.Handle("GET /api/v1/admin/ledger/integrity", requireRead(http.HandlerFunc(controller.GetLedgerIntegrityReport)))
	mux.Handle("GET /api/v1/admin/ledger/statement", requireRead(http.HandlerFunc(controller.GetAccountStatement)))
	mux.Handle("GET /api/v1/admin/ledger/currencies", requireRead(http.HandlerFunc(controller.ListLedgerCurrencies)))
	mux.Handle("GET /api/v1/admin/ledger/accounts", requireRead(http.HandlerFunc(controller.ListLedgerAccounts)))
	mux.Handle("GET /api/v1/admin/ledger/journal-entries", requireRead(http.HandlerFunc(controller.ListJournalEntries)))
	mux.Handle("POST /api/v1/admin/ledger/journal-entries/{entryId}/reversal", requireReverse(http.HandlerFunc(controller.ReverseJournalEntry)))
}

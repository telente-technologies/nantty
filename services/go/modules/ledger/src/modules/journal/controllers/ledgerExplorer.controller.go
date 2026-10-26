package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	listjournalentries "nantty/modules/ledger/src/modules/journal/queries/listJournalEntries"
	listledgeraccounts "nantty/modules/ledger/src/modules/journal/queries/listLedgerAccounts"
	listledgercurrencies "nantty/modules/ledger/src/modules/journal/queries/listLedgerCurrencies"
	"nantty/modules/ledger/src/modules/journal/validators"
	"nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

func (controller JournalController) ListLedgerCurrencies(writer http.ResponseWriter, request *http.Request) {
	page, err := listledgercurrencies.Handler{Container: controller.Container}.Execute(request.Context(), listledgercurrencies.Query{})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller JournalController) ListLedgerAccounts(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	currency := strings.ToUpper(parameters.Get("currency"))
	collector := &utils.IssueCollector{}
	if !validators.IsValidCurrencyOrCoinUnit(currency) {
		collector.Add("currency", "must be an ISO 4217 code or COIN")
	}
	collector.RequireLength("ownerId", parameters.Get("ownerId"), 0, 80)
	collector.RequireLength("cursor", parameters.Get("cursor"), 0, 200)
	if err := collector.Result(); err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	page, err := listledgeraccounts.Handler{Container: controller.Container}.Execute(request.Context(), listledgeraccounts.Query{
		Currency: currency, OwnerId: parameters.Get("ownerId"), AfterCode: parameters.Get("cursor"), Limit: utils.ReadPageLimit(request),
	})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller JournalController) ListJournalEntries(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	currency := strings.ToUpper(parameters.Get("currency"))
	collector := &utils.IssueCollector{}
	if !validators.IsValidCurrencyOrCoinUnit(currency) {
		collector.Add("currency", "must be an ISO 4217 code or COIN")
	}
	collector.RequireLength("accountCode", parameters.Get("accountCode"), 0, 200)
	collector.RequireLength("reference", parameters.Get("reference"), 0, 255)
	query := listjournalentries.Query{Currency: currency, AccountCode: parameters.Get("accountCode"), Reference: parameters.Get("reference"), Limit: utils.ReadPageLimit(request)}
	if cursor := parameters.Get("cursor"); cursor != "" {
		parsed, err := uuid.Parse(cursor)
		if err != nil {
			collector.Add("cursor", "is invalid")
		}
		query.AfterId = &parsed
	}
	if err := collector.Result(); err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	page, err := listjournalentries.Handler{Container: controller.Container}.Execute(request.Context(), query)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

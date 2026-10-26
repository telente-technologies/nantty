package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/container"
	reversejournalentry "nantty/modules/ledger/src/modules/journal/commands/reverseJournalEntry"
	"nantty/modules/ledger/src/modules/journal/dtos"
	getaccountstatement "nantty/modules/ledger/src/modules/journal/queries/getAccountStatement"
	getledgerintegrityreport "nantty/modules/ledger/src/modules/journal/queries/getLedgerIntegrityReport"
	"nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type JournalController struct {
	Container *container.Container
}

func (controller JournalController) respondWithError(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Resources.Logger, err)
}

func (controller JournalController) GetLedgerIntegrityReport(writer http.ResponseWriter, request *http.Request) {
	report, err := getledgerintegrityreport.Handler{Container: controller.Container}.Execute(request.Context(), getledgerintegrityreport.Query{})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, report)
}

func (controller JournalController) GetAccountStatement(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	collector := &utils.IssueCollector{}
	collector.RequireLength("code", parameters.Get("code"), 1, 200)
	collector.RequireLength("currency", parameters.Get("currency"), 3, 4)
	query := getaccountstatement.Query{AccountCode: parameters.Get("code"), Currency: parameters.Get("currency"), Limit: utils.ReadPageLimit(request)}
	if cursor := parameters.Get("cursor"); cursor != "" {
		parsed, err := uuid.Parse(cursor)
		if err != nil {
			collector.Add("cursor", "is invalid")
		}
		query.AfterLineId = &parsed
	}
	if err := collector.Result(); err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	statement, err := getaccountstatement.Handler{Container: controller.Container}.Execute(request.Context(), query)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, statement)
}

func (controller JournalController) ReverseJournalEntry(writer http.ResponseWriter, request *http.Request) {
	if _, err := utils.ReadRequiredIdempotencyKey(request); err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	entryId, err := uuid.Parse(request.PathValue("entryId"))
	if err != nil {
		controller.respondWithError(writer, request, httpserver.ErrNotFound)
		return
	}
	body, err := utils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ReverseJournalEntryRequestDto) error {
		collector := &utils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 3, 500)
		return collector.Result()
	})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	reversal, err := reversejournalentry.Handler{Container: controller.Container}.Execute(request.Context(), reversejournalentry.Command{EntryId: entryId, Reason: body.Reason, ActorStaffId: staff.Id})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	utils.WriteIdempotentJsonResponse(writer, http.StatusCreated, reversal, reversal.Replayed)
}

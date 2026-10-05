package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	listinvoices "zudomart/modules/ads/src/modules/billing/queries/listInvoices"
	renderbillingdocument "zudomart/modules/ads/src/modules/billing/queries/renderBillingDocument"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller BillingController) ListInvoices(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit, err := utils.PageLimit(request, 24)
		if err != nil {
			return err
		}
		items, next, err := (listinvoices.Handler{Container: controller.Container}).Execute(request.Context(), listinvoices.Query{AccountId: account, UserId: user, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller BillingController) DownloadInvoice(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		document, err := (renderbillingdocument.Handler{Container: controller.Container}).Invoice(request.Context(), renderbillingdocument.Query{AccountId: account, UserId: user, InvoiceId: request.PathValue("invoiceId")})
		return writePdf(writer, document, err)
	})
}

func (controller BillingController) DownloadReceipt(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		document, err := (renderbillingdocument.Handler{Container: controller.Container}).Receipt(request.Context(), renderbillingdocument.Query{AccountId: account, UserId: user, TransactionId: request.PathValue("transactionId")})
		return writePdf(writer, document, err)
	})
}

func writePdf(writer http.ResponseWriter, document renderbillingdocument.Document, err error) error {
	if err != nil {
		return err
	}
	writer.Header().Set("Content-Type", "application/pdf")
	writer.Header().Set("Content-Disposition", `attachment; filename="`+document.FileName+`"`)
	writer.Header().Set("Content-Length", strconv.Itoa(len(document.Bytes)))
	writer.Header().Set("Cache-Control", "private, no-store")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(document.Bytes)
	return nil
}

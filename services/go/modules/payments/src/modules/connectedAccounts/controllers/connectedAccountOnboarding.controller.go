package controllers

import (
	"net/http"
	"regexp"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/modules/connectedAccounts/dtos"
	"nantty/platform/httpserver"
)

var (
	elevenDigitIdentityPattern = regexp.MustCompile(`^[0-9]{11}$`)
	isoDatePattern             = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`)
)

func (controller ConnectedAccountsController) ReceiveInternalDomainEvent(writer http.ResponseWriter, request *http.Request) {
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.InternalDomainEventDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("type", body.Type, 1, 120)
		collector.RequireLength("data.accountId", body.Data.AccountId, 1, 80)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if body.Type == "creatorApplication.approved" {
		if err := controller.Application.Gateway.HandleCreatorApproved(request.Context(), body.Data.AccountId); err != nil {
			controller.fail(writer, request, err)
			return
		}
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]bool{"received": true})
}

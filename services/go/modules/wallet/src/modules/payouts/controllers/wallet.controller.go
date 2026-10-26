package controllers

import (
	"net/http"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/payouts"
	addpayoutaccount "nantty/modules/wallet/src/modules/payouts/commands/addPayoutAccount"
	removepayoutaccount "nantty/modules/wallet/src/modules/payouts/commands/removePayoutAccount"
	getwalletsummary "nantty/modules/wallet/src/modules/payouts/queries/getWalletSummary"
	listpayoutaccounts "nantty/modules/wallet/src/modules/payouts/queries/listPayoutAccounts"
	listwallettransactions "nantty/modules/wallet/src/modules/payouts/queries/listWalletTransactions"
	"nantty/modules/wallet/src/modules/payouts/services"
	"nantty/modules/wallet/src/modules/payouts/validators"
	"nantty/platform/httpserver"
)

type WalletController struct {
	Application *payouts.Application
}

func (controller WalletController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller WalletController) GetWalletSummary(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	summary, err := getwalletsummary.Handler{Application: controller.Application}.Execute(request.Context(), getwalletsummary.Query{
		UserId: principal.UserId, Currency: controller.Application.Container.Currency.ResolveViewerCurrency(request),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, summary)
}

func (controller WalletController) ListWalletTransactions(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	cursor, err := validators.ReadCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := listwallettransactions.Handler{Application: controller.Application}.Execute(request.Context(), listwallettransactions.Query{
		UserId: principal.UserId, Currency: controller.Application.Container.Currency.ResolveViewerCurrency(request), AfterLineId: cursor, Limit: ledgerutils.ReadPageLimit(request),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller WalletController) ListPayoutAccounts(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	accounts, err := listpayoutaccounts.Handler{Application: controller.Application}.Execute(request.Context(), listpayoutaccounts.Query{UserId: principal.UserId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(accounts, ""))
}

func (controller WalletController) AddPayoutAccount(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateAddPayoutAccountRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	account, err := addpayoutaccount.Handler{Application: controller.Application}.Execute(request.Context(), addpayoutaccount.Command{
		UserId: principal.UserId, CountryCode: validators.NormaliseCountryCode(body.CountryCode), BankCode: body.BankCode, AccountNumber: body.AccountNumber,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, account)
}

func (controller WalletController) RemovePayoutAccount(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	accountId, err := uuid.Parse(request.PathValue("payoutAccountId"))
	if err != nil {
		controller.fail(writer, request, services.ErrPayoutAccountNotFound)
		return
	}
	if err := (removepayoutaccount.Handler{Application: controller.Application}).Execute(request.Context(), removepayoutaccount.Command{UserId: principal.UserId, PayoutAccountId: accountId}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

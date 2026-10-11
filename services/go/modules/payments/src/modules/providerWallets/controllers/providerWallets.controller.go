package controllers

import (
	"errors"
	"net/http"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/generated/ent/providerwalletnumber"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/platform/httpserver"
)

type ProviderWalletsController struct {
	Application *gateway.Application
}

func (controller ProviderWalletsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

type walletResponse struct {
	Wallet   models.ProviderWalletView     `json:"wallet"`
	Balances models.WalletBalancesView     `json:"balances"`
	Limits   services.WalletDailyLimitView `json:"limits"`
}

// A wallet that is not provisioned yet is a normal state for a read, not a conflict: the clients show the verify prompt.
type walletNotReadyResponse struct {
	Wallet   *models.ProviderWalletView `json:"wallet"`
	Status   string                     `json:"status"`
	Balances models.WalletBalancesView  `json:"balances"`
}

func (controller ProviderWalletsController) GetMyWallet(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	response, err := controller.readWallet(request, principal.UserId)
	writer.Header().Set("Cache-Control", "no-store")
	if errors.Is(err, services.ErrProviderWalletMissing) {
		httpserver.WriteJsonResponse(writer, http.StatusOK, walletNotReadyResponse{Status: "not_ready", Balances: models.WalletBalancesView{Currency: "NGN"}})
		return
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, response)
}

func (controller ProviderWalletsController) ActivateMyWallet(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if _, err := controller.Application.Gateway.EnsureProviderWalletAtLevelOne(request.Context(), principal.UserId); err != nil {
		controller.fail(writer, request, err)
		return
	}
	response, err := controller.readWallet(request, principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, response)
}

func (controller ProviderWalletsController) readWallet(request *http.Request, userId string) (walletResponse, error) {
	ctx, container := request.Context(), controller.Application.Container
	database := container.Resources.Database
	wallet, err := controller.Application.Gateway.FindProviderWallet(ctx, database, userId)
	if err != nil {
		return walletResponse{}, err
	}
	numbers, err := container.Client(database).ProviderWalletNumber.Query().Where(providerwalletnumber.WalletID(wallet.ID)).All(ctx)
	if err != nil {
		return walletResponse{}, err
	}
	currency := wallet.Currency
	accounts := []ledgermodels.AccountRef{
		ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.WalletOutgoingAccount(userId, currency),
		ledgermodels.WalletReservedPayoutAccount(userId, currency), ledgermodels.WalletDebtAccount(userId, currency),
	}
	balances, err := container.Ledger.ReadAccountBalances(ctx, database, accounts)
	if err != nil {
		return walletResponse{}, err
	}
	locked, err := container.Ledger.SumBalancesOfAccountsWithCodePrefix(ctx, database, ledgermodels.WalletEscrowLockedAccountCodePrefix(userId), currency)
	if err != nil {
		return walletResponse{}, err
	}
	limits, err := controller.Application.Gateway.ReadWalletDailyLimit(ctx, database, userId, currency)
	if err != nil {
		return walletResponse{}, err
	}
	return walletResponse{
		Limits: limits,
		Wallet: services.ConvertProviderWalletToView(wallet, numbers),
		Balances: models.WalletBalancesView{
			Currency: currency, AvailableMinor: balances[accounts[0].Key()], DepositHoldMinor: balances[accounts[1].Key()], OutgoingMinor: balances[accounts[2].Key()],
			ReservedMinor: balances[accounts[3].Key()], DebtMinor: balances[accounts[4].Key()], EscrowLockedMinor: locked,
		},
	}, nil
}

func (controller ProviderWalletsController) PayWithWallet(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reference := request.PathValue("reference")
	if len(reference) == 0 || len(reference) > 80 {
		controller.fail(writer, request, services.ErrPaymentNotFound)
		return
	}
	paid, err := controller.Application.Gateway.PayIntentFromWallet(request.Context(), models.WalletPaymentRequest{UserId: principal.UserId, Reference: reference, IdempotencyKey: key})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, paid)
}

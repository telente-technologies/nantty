package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/coins"
	convertearnedcoins "zudomart/modules/wallet/src/modules/coins/commands/convertEarnedCoins"
	redeemstorereceipt "zudomart/modules/wallet/src/modules/coins/commands/redeemStoreReceipt"
	startcoinpurchase "zudomart/modules/wallet/src/modules/coins/commands/startCoinPurchase"
	transfercoins "zudomart/modules/wallet/src/modules/coins/commands/transferCoins"
	verifycoinpurchase "zudomart/modules/wallet/src/modules/coins/commands/verifyCoinPurchase"
	getcoinbalance "zudomart/modules/wallet/src/modules/coins/queries/getCoinBalance"
	listcoinactivity "zudomart/modules/wallet/src/modules/coins/queries/listCoinActivity"
	listcoinpackages "zudomart/modules/wallet/src/modules/coins/queries/listCoinPackages"
	quotecointransfer "zudomart/modules/wallet/src/modules/coins/queries/quoteCoinTransfer"
	"zudomart/modules/wallet/src/modules/coins/services"
	"zudomart/modules/wallet/src/modules/coins/validators"
	"zudomart/platform/httpserver"
)

type CoinsController struct {
	Application *coins.Application
}

func (controller CoinsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func clientPlatform(request *http.Request) string {
	return strings.ToLower(strings.TrimSpace(request.Header.Get("X-Client-Platform")))
}

func (controller CoinsController) ListCoinPackages(writer http.ResponseWriter, request *http.Request) {
	packages, err := listcoinpackages.Handler{Application: controller.Application}.Execute(request.Context(), listcoinpackages.Query{
		ClientPlatform: clientPlatform(request), Currency: controller.Application.Container.Currency.ResolvePricingRegion(request).Currency,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Vary", "Authorization, X-Client-Platform, X-Store-Storefront, X-Client-Region")
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(packages, ""))
}

func (controller CoinsController) GetCoinBalance(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	balance, err := getcoinbalance.Handler{Application: controller.Application}.Execute(request.Context(), getcoinbalance.Query{UserId: principal.UserId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, balance)
}

func (controller CoinsController) ListCoinActivity(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := listcoinactivity.Query{UserId: principal.UserId, Limit: ledgerutils.ReadPageLimit(request)}
	if raw := request.URL.Query().Get("cursor"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}}))
			return
		}
		query.AfterLineId = &parsed
	}
	page, err := listcoinactivity.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller CoinsController) StartCoinPurchase(writer http.ResponseWriter, request *http.Request) {
	principal, key, ok := controller.requireUserAndKey(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateStartCoinPurchaseRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	provider := body.Provider
	if provider == "" {
		provider = controller.Application.Container.Payments.Container.Settings.DefaultProvider
	}
	started, replayed, err := startcoinpurchase.Handler{Application: controller.Application}.Execute(request.Context(), startcoinpurchase.Command{
		UserId: principal, ClientPlatform: clientPlatform(request), PackageId: body.PackageId, Provider: provider,
		Currency: controller.Application.Container.Currency.ResolvePricingRegion(request).Currency, ReturnTo: body.ReturnTo, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, started, replayed)
}

func (controller CoinsController) VerifyCoinPurchase(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reference := request.PathValue("reference")
	if !validators.IsValidPurchaseReference(reference) {
		controller.fail(writer, request, services.ErrCoinPurchaseNotFound)
		return
	}
	verified, err := verifycoinpurchase.Handler{Application: controller.Application}.Execute(request.Context(), verifycoinpurchase.Command{UserId: principal.UserId, Reference: reference})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, verified)
}

func (controller CoinsController) RedeemStoreReceipt(writer http.ResponseWriter, request *http.Request) {
	principal, key, ok := controller.requireUserAndKey(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateStoreReceiptRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	verified, replayed, err := redeemstorereceipt.Handler{Application: controller.Application}.Execute(request.Context(), redeemstorereceipt.Command{
		UserId: principal, Platform: body.Platform, ProductId: body.ProductId, Receipt: body.Receipt, TransactionId: body.TransactionId, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, verified, replayed)
}

func (controller CoinsController) QuoteCoinTransfer(writer http.ResponseWriter, request *http.Request) {
	coinsToSend, err := strconv.ParseInt(request.URL.Query().Get("coins"), 10, 64)
	if err != nil || coinsToSend < 1 || coinsToSend > 100_000_000 {
		controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "coins", Message: "must be a whole number from 1 to 100000000"}}))
		return
	}
	quote, err := quotecointransfer.Handler{Application: controller.Application}.Execute(request.Context(), quotecointransfer.Query{Coins: coinsToSend})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, quote)
}

func (controller CoinsController) TransferCoins(writer http.ResponseWriter, request *http.Request) {
	principal, key, ok := controller.requireUserAndKey(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateCoinTransferRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	receipt, replayed, err := transfercoins.Handler{Application: controller.Application}.Execute(request.Context(), transfercoins.Command{Input: services.CoinTransferInput{
		SenderUserId: principal, RecipientUserId: body.RecipientUserId, Coins: body.Coins, Note: strings.TrimSpace(body.Note), IdempotencyKey: key,
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, receipt, replayed)
}

func (controller CoinsController) ConvertEarnedCoins(writer http.ResponseWriter, request *http.Request) {
	principal, key, ok := controller.requireUserAndKey(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateConvertEarnedCoinsRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	currency := body.Currency
	if currency == "" {
		currency = controller.Application.Container.Currency.ResolveViewerCurrency(request)
	}
	receipt, replayed, err := convertearnedcoins.Handler{Application: controller.Application}.Execute(request.Context(), convertearnedcoins.Command{Input: services.EarnedCoinConversionInput{
		UserId: principal, Coins: body.Coins, Currency: currency, IdempotencyKey: key,
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, receipt, replayed)
}

func (controller CoinsController) requireUserAndKey(writer http.ResponseWriter, request *http.Request) (string, string, bool) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return "", "", false
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return "", "", false
	}
	return principal.UserId, key, true
}

package controllers

import (
	"net/http"

	"github.com/google/uuid"

	addsellerpayoutaccount "zudomart/modules/wallet/src/modules/sellerMoney/commands/addSellerPayoutAccount"
	removesellerpayoutaccount "zudomart/modules/wallet/src/modules/sellerMoney/commands/removeSellerPayoutAccount"
	resolvesellerpayoutaccount "zudomart/modules/wallet/src/modules/sellerMoney/commands/resolveSellerPayoutAccount"
	setdefaultsellerpayoutaccount "zudomart/modules/wallet/src/modules/sellerMoney/commands/setDefaultSellerPayoutAccount"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	listsellerbanks "zudomart/modules/wallet/src/modules/sellerMoney/queries/listSellerBanks"
	listsellerpayoutaccounts "zudomart/modules/wallet/src/modules/sellerMoney/queries/listSellerPayoutAccounts"
	"zudomart/modules/wallet/src/modules/sellerMoney/validators"
	"zudomart/platform/httpserver"
)

func (controller SellerMoneyController) Banks(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	banks := listsellerbanks.Handler{Application: controller.Application}.Execute(request.Context(), listsellerbanks.Query{Seller: seller})
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(banks, ""))
}

func (controller SellerMoneyController) PayoutAccounts(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	accounts, err := listsellerpayoutaccounts.Handler{Application: controller.Application}.Execute(request.Context(), listsellerpayoutaccounts.Query{Seller: seller})
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(accounts, ""), err)
}

func (controller SellerMoneyController) ResolvePayoutAccount(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	body, err := decode(writer, request, validators.ValidateResolvePayoutAccount(seller.CountryCode))
	var view dtos.ResolvedPayoutAccountView
	if err == nil {
		view, err = resolvesellerpayoutaccount.Handler{Application: controller.Application}.Execute(request.Context(), resolvesellerpayoutaccount.Command{Seller: seller, Body: body})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) AddPayoutAccount(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	body, err := decode(writer, request, validators.ValidateAddPayoutAccount)
	var view dtos.PayoutAccountView
	if err == nil {
		view, err = addsellerpayoutaccount.Handler{Application: controller.Application}.Execute(request.Context(), addsellerpayoutaccount.Command{Seller: seller, ResolutionId: uuid.MustParse(body.ResolutionId)})
	}
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerMoneyController) UpdatePayoutAccount(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	accountId, err := pathIdentifier(request, "accountId")
	if err == nil {
		_, err = decode(writer, request, validators.ValidateUpdatePayoutAccount)
	}
	var view dtos.PayoutAccountView
	if err == nil {
		view, err = setdefaultsellerpayoutaccount.Handler{Application: controller.Application}.Execute(request.Context(), setdefaultsellerpayoutaccount.Command{Seller: seller, AccountId: accountId})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) RemovePayoutAccount(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	accountId, err := pathIdentifier(request, "accountId")
	if err == nil {
		err = removesellerpayoutaccount.Handler{Application: controller.Application}.Execute(request.Context(), removesellerpayoutaccount.Command{Seller: seller, AccountId: accountId})
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

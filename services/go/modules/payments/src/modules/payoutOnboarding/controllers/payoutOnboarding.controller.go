package controllers

import (
	"net/http"
	"regexp"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/payments/src/modules/payoutOnboarding/dtos"
	"zudomart/platform/httpserver"
)

var (
	identityNumberPattern = regexp.MustCompile(`^[0-9]{11}$`)
	birthDatePattern      = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`)
	accountNumberPattern  = regexp.MustCompile(`^[0-9]{10}$`)
	bankCodePattern       = regexp.MustCompile(`^[0-9A-Za-z]{2,20}$`)
)

type PayoutOnboardingController struct {
	Application *gateway.Application
}

func (controller PayoutOnboardingController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller PayoutOnboardingController) respondWithState(writer http.ResponseWriter, request *http.Request, userId string) {
	state, err := controller.Application.Gateway.ReadPayoutOnboardingState(request.Context(), userId, request.URL.Query().Get("role"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, state)
}

func (controller PayoutOnboardingController) GetState(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if request.URL.Query().Get("refresh") == "true" {
		if _, err := controller.Application.Gateway.RefreshMyPayoutAccount(request.Context(), principal.UserId); err != nil && err != services.ErrConnectedAccountMissing {
			controller.fail(writer, request, err)
			return
		}
	}
	controller.respondWithState(writer, request, principal.UserId)
}

func (controller PayoutOnboardingController) SaveIdentity(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.IdentityRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("legalName", body.LegalName, 3, 160)
		if !birthDatePattern.MatchString(body.DateOfBirth) {
			collector.Add("dateOfBirth", "must be YYYY-MM-DD")
		}
		collector.RequireLength("addressLine1", body.AddressLine1, 3, 200)
		collector.RequireLength("city", body.City, 2, 80)
		collector.RequireLength("state", body.State, 2, 80)
		collector.RequireOneOf("idType", body.IdType, "bvn", "nin")
		if !identityNumberPattern.MatchString(body.IdNumber) {
			collector.Add("idNumber", "must be 11 digits")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	role := request.URL.Query().Get("role")
	if role == "" && body.RegisteredBusiness {
		role = "seller"
	}
	if err := controller.Application.Gateway.SavePayoutOnboardingIdentity(request.Context(), principal.UserId, services.OnboardingIdentityInput{
		Role: role, LegalName: body.LegalName, DateOfBirth: body.DateOfBirth, AddressLine1: body.AddressLine1, City: body.City, State: body.State,
		IdType: body.IdType, IdNumber: body.IdNumber, RegisteredBusiness: body.RegisteredBusiness,
	}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithState(writer, request, principal.UserId)
}

func (controller PayoutOnboardingController) SaveBusiness(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.BusinessRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("cacNumber", body.CacNumber, 4, 40)
		collector.RequireLength("businessType", body.BusinessType, 2, 60)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if err := controller.Application.Gateway.SavePayoutOnboardingBusiness(request.Context(), principal.UserId, services.BusinessDetails{CacNumber: body.CacNumber, BusinessType: body.BusinessType}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithState(writer, request, principal.UserId)
}

func validateBankFields(collector *ledgerutils.IssueCollector, bankCode, accountNumber string) {
	if !bankCodePattern.MatchString(bankCode) {
		collector.Add("bankCode", "has an invalid format")
	}
	if !accountNumberPattern.MatchString(accountNumber) {
		collector.Add("accountNumber", "must be 10 digits")
	}
}

func (controller PayoutOnboardingController) ResolveBankAccount(writer http.ResponseWriter, request *http.Request) {
	if _, err := ledgerutils.RequirePrincipal(request); err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ResolveRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		validateBankFields(collector, body.BankCode, body.AccountNumber)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	accountName, err := controller.Application.Gateway.ResolveOnboardingBankAccount(request.Context(), body.BankCode, body.AccountNumber)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]string{"accountName": accountName})
}

func (controller PayoutOnboardingController) SaveBank(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.BankRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		validateBankFields(collector, body.BankCode, body.AccountNumber)
		collector.RequireLength("bankName", body.BankName, 2, 120)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if err := controller.Application.Gateway.SavePayoutOnboardingBank(request.Context(), principal.UserId, services.OnboardingBankInput{
		BankCode: body.BankCode, BankName: body.BankName, AccountNumber: body.AccountNumber,
	}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithState(writer, request, principal.UserId)
}

func (controller PayoutOnboardingController) Retry(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if err := controller.Application.Gateway.RetryPayoutOnboarding(request.Context(), principal.UserId); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithState(writer, request, principal.UserId)
}

func (controller PayoutOnboardingController) CreateDocumentLink(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	link, err := controller.Application.Gateway.CreatePayoutVerificationLink(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.DocumentLinkDto{Url: link.Url, ReturnUrl: link.ReturnUrl, ExpiresAt: link.ExpiresAt})
}

func (controller PayoutOnboardingController) GetPayoutFees(writer http.ResponseWriter, request *http.Request) {
	fee, err := controller.Application.Gateway.QuotePayoutFee("NGN", 5_000_001)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.PayoutFeesDto{
		Currency: "NGN", Kind: "flat", Fee: dtos.MoneyDto{AmountMinor: fee, Currency: "NGN"},
		ArrivalEstimate: controller.Application.Container.Settings.PayoutArrivalEstimate,
		FirstPayoutNote: "Your first payout can take a few extra minutes while it is checked.",
	})
}

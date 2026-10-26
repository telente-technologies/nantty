package controllers

import (
	"net/http"
	"regexp"
	"strings"

	"nantty/modules/ledger/src/utils"
	resolvebankaccount "nantty/modules/payments/src/modules/banks/commands/resolveBankAccount"
	"nantty/modules/payments/src/modules/banks/dtos"
	listbanks "nantty/modules/payments/src/modules/banks/queries/listBanks"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/platform/httpserver"
)

var (
	countryCodePattern   = regexp.MustCompile(`^[A-Z]{2}$`)
	bankCodePattern      = regexp.MustCompile(`^[A-Za-z0-9-]{2,12}$`)
	nubanAccountNumber   = regexp.MustCompile(`^\d{10}$`)
	genericAccountNumber = regexp.MustCompile(`^\d{6,20}$`)
)

type BanksController struct {
	Application *gateway.Application
}

func readCountryCode(raw string) string {
	country := strings.ToUpper(strings.TrimSpace(raw))
	if country == "" {
		return "NG"
	}
	return country
}

func (controller BanksController) ListBanks(writer http.ResponseWriter, request *http.Request) {
	country := readCountryCode(request.URL.Query().Get("country"))
	if !countryCodePattern.MatchString(country) {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "country", Message: "must be an ISO 3166 alpha-2 code"}}))
		return
	}
	banks := listbanks.Handler{Application: controller.Application}.Execute(request.Context(), listbanks.Query{CountryCode: country})
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(banks, ""))
}

func (controller BanksController) ResolveBankAccount(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ResolveBankAccountRequestDto) error {
		collector := &utils.IssueCollector{}
		country := readCountryCode(body.CountryCode)
		if !bankCodePattern.MatchString(body.BankCode) {
			collector.Add("bankCode", "has an invalid format")
		}
		pattern := genericAccountNumber
		if country == "NG" {
			pattern = nubanAccountNumber
		}
		if !pattern.MatchString(body.AccountNumber) {
			collector.Add("accountNumber", "has an invalid format")
		}
		return collector.Result()
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	accountName, err := resolvebankaccount.Handler{Application: controller.Application}.Execute(request.Context(), resolvebankaccount.Command{
		CountryCode: readCountryCode(body.CountryCode), BankCode: body.BankCode, AccountNumber: body.AccountNumber,
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ResolvedBankAccountDto{AccountName: accountName})
}

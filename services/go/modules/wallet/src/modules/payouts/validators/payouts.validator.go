package validators

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/payouts/dtos"
	"nantty/platform/httpserver"
)

var (
	bankCodePattern      = regexp.MustCompile(`^[A-Za-z0-9-]{2,12}$`)
	branchCodePattern    = regexp.MustCompile(`^[A-Za-z0-9-]{1,40}$`)
	nubanAccountNumber   = regexp.MustCompile(`^\d{10}$`)
	genericAccountNumber = regexp.MustCompile(`^\d{6,20}$`)
	countryCodePattern   = regexp.MustCompile(`^[A-Z]{2}$`)
	currencyPattern      = regexp.MustCompile(`^[A-Z]{3}$`)
)

func NormaliseCountryCode(raw string) string {
	if country := strings.ToUpper(strings.TrimSpace(raw)); country != "" {
		return country
	}
	return "NG"
}

func ValidateAddPayoutAccountRequest(request dtos.AddPayoutAccountRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	country := NormaliseCountryCode(request.CountryCode)
	if !countryCodePattern.MatchString(country) {
		collector.Add("countryCode", "must be an ISO 3166 alpha-2 code")
	}
	if !bankCodePattern.MatchString(request.BankCode) {
		collector.Add("bankCode", "has an invalid format")
	}
	if request.BranchCode != "" && !branchCodePattern.MatchString(request.BranchCode) {
		collector.Add("branchCode", "has an invalid format")
	}
	pattern := genericAccountNumber
	if country == "NG" {
		pattern = nubanAccountNumber
	}
	if !pattern.MatchString(request.AccountNumber) {
		collector.Add("accountNumber", "Account numbers have 10 digits")
	}
	return collector.Result()
}

func ValidateWithdrawalRequest(request dtos.WithdrawalRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireUuid("payoutAccountId", request.PayoutAccountId)
	collector.RequireRange("amount.amountMinor", request.Amount.AmountMinor, 1, 1_000_000_000_000)
	if !currencyPattern.MatchString(request.Amount.Currency) {
		collector.Add("amount.currency", "must be an ISO 4217 code")
	}
	return collector.Result()
}

func ValidateReviewWithdrawalRequest(request dtos.ReviewWithdrawalRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireOneOf("decision", request.Decision, "approve", "reject", "hold")
	if request.Decision == "reject" || request.Decision == "hold" {
		collector.RequireLength("reason", strings.TrimSpace(request.Reason), 3, 300)
	} else {
		collector.RequireLength("reason", strings.TrimSpace(request.Reason), 0, 300)
	}
	return collector.Result()
}

func ReadWithdrawalQuoteQuery(request *http.Request) (uuid.UUID, int64, string, error) {
	parameters := request.URL.Query()
	collector := &ledgerutils.IssueCollector{}
	accountId, accountError := uuid.Parse(parameters.Get("payoutAccountId"))
	if accountError != nil {
		collector.Add("payoutAccountId", "must be a UUID")
	}
	amount, amountError := strconv.ParseInt(parameters.Get("amountMinor"), 10, 64)
	if amountError != nil || amount < 1 || amount > 1_000_000_000_000 {
		collector.Add("amountMinor", "must be a positive whole number of minor units")
	}
	currency := parameters.Get("currency")
	if !currencyPattern.MatchString(currency) {
		collector.Add("currency", "must be an ISO 4217 code")
	}
	return accountId, amount, currency, collector.Result()
}

func ReadCursor(request *http.Request) (*uuid.UUID, error) {
	raw := request.URL.Query().Get("cursor")
	if raw == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}})
	}
	return &parsed, nil
}

package validators

import (
	"regexp"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/savedCards/dtos"
)

var (
	bankAccountNumberPattern = regexp.MustCompile(`^[0-9]{10}$`)
	bankCodePattern          = regexp.MustCompile(`^[0-9A-Za-z]{2,20}$`)
)

func ValidateStartSavedCardSetupRequest(request dtos.StartSavedCardSetupRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("returnTo", request.ReturnTo, 0, 300)
	return collector.Result()
}

func ValidateChargeSavedCardRequest(request dtos.ChargeSavedCardRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("paymentReference", request.PaymentReference, 1, 80)
	if _, err := uuid.Parse(request.SavedCardId); err != nil {
		collector.Add("savedCardId", "must be one of your saved cards")
	}
	return collector.Result()
}

func ValidateRefundBankDestinationRequest(request dtos.RefundBankDestinationRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	if !bankCodePattern.MatchString(request.BankCode) {
		collector.Add("bankCode", "has an invalid format")
	}
	if !bankAccountNumberPattern.MatchString(request.AccountNumber) {
		collector.Add("accountNumber", "must be 10 digits")
	}
	return collector.Result()
}

package validators

import (
	"net/url"
	"regexp"
	"slices"

	"zudomart/modules/catalog/src/modules/sellerApplications/dtos"
	"zudomart/modules/catalog/src/utils"
)

var (
	IdentityDocumentTypes = []string{"nin_slip", "drivers_licence", "voters_card", "international_passport"}
	documentNumberPattern = regexp.MustCompile(`^[A-Za-z0-9-]{5,40}$`)
	bankCodePattern       = regexp.MustCompile(`^[0-9A-Za-z]{2,10}$`)
	accountNumberPattern  = regexp.MustCompile(`^\d{10}$`)
	phonePattern          = regexp.MustCompile(`^\+?[0-9 ()-]{7,20}$`)
)

func ValidateSubmit(request dtos.SubmitApplicationRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("storeName", request.StoreName, 2, 80)
	utils.ParseIdentifier("categoryId", request.CategoryId, &issues)
	if len(request.Description) > 1000 {
		issues.Add("description", "must be at most 1000 characters")
	}
	if !phonePattern.MatchString(request.Phone) {
		issues.Add("phone", "must be a valid phone number")
	}
	issues.CheckLength("addressLine", request.AddressLine, 5, 200)
	issues.CheckLength("city", request.City, 2, 80)
	issues.CheckLength("state", request.State, 2, 80)
	document := request.IdentityDocument
	if !slices.Contains(IdentityDocumentTypes, document.DocumentType) {
		issues.Add("identityDocument.documentType", "must be nin_slip, drivers_licence, voters_card or international_passport")
	}
	if !documentNumberPattern.MatchString(document.DocumentNumber) {
		issues.Add("identityDocument.documentNumber", "must be 5-40 letters, numbers or dashes")
	}
	if parsed, err := url.Parse(document.DocumentPhotoUrl); err != nil || parsed.Scheme != "https" || parsed.Host == "" || len(document.DocumentPhotoUrl) > 2048 {
		issues.Add("identityDocument.documentPhotoUrl", "must be an https:// address")
	}
	if !bankCodePattern.MatchString(request.PayoutAccount.BankCode) {
		issues.Add("payoutAccount.bankCode", "Choose a payout bank from the list.")
	}
	if !accountNumberPattern.MatchString(request.PayoutAccount.AccountNumber) {
		issues.Add("payoutAccount.accountNumber", "must be a 10-digit account number")
	}
	return issues.AsError()
}

func ValidateDecision(request dtos.DecisionRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("reason", request.Reason, 5, 1000)
	return issues.AsError()
}

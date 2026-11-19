package services

import (
	"slices"
	"strings"

	"golang.org/x/text/language"
	"golang.org/x/text/language/display"

	"nantty/modules/users/src/integrations"
)

const (
	VerificationMethodDocument = "document"
	VerificationMethodIdNumber = "id_number"
)

func SmileProductEnabled(enabledProducts []string, product string) bool {
	return slices.Contains(enabledProducts, product)
}

func SmileIdTypeEnabled(enabledTypes []string, country, idType string) bool {
	return slices.Contains(enabledTypes, country+":"+idType)
}

func SmileDocumentTypeAllowed(allowedTypes []string, country, idType string) bool {
	return len(allowedTypes) == 0 || SmileIdTypeEnabled(allowedTypes, country, idType)
}

func IsPersonalIdentityNumberType(idType integrations.SmileIdSupportedKycType) bool {
	if strings.TrimSpace(idType.BankCode) != "" || strings.EqualFold(strings.TrimSpace(idType.Type), "BANK_ACCOUNT") {
		return false
	}
	for _, field := range idType.RequiredFields {
		if strings.EqualFold(strings.TrimSpace(field), "bank_code") {
			return false
		}
	}
	return true
}

func CountryNameFromCode(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' {
		return code
	}
	name := display.Regions(language.English).Name(language.MustParseRegion(code))
	if name == "" {
		return code
	}
	return name
}

func SmileProductFor(method, country, idType string) (string, bool) {
	return SmileProductForSelection(method, country, idType, "")
}

func SmileProductForSelection(method, country, idType, requestedProduct string) (string, bool) {
	if country == "" || idType == "" {
		return "", false
	}
	switch method {
	case VerificationMethodDocument:
		if requestedProduct == "" || requestedProduct == "document_verification" || requestedProduct == "enhanced_document_verification" {
			if requestedProduct == "" {
				requestedProduct = "document_verification"
			}
			return requestedProduct, true
		}
	case VerificationMethodIdNumber:
		if requestedProduct == "" || requestedProduct == "enhanced_kyc" {
			return "enhanced_kyc", true
		}
	}
	return "", false
}

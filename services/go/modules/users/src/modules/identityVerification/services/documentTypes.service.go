package services

import "slices"

type CountryDocuments struct {
	Types    []string
	Enhanced bool
}

var SupportedDocuments = map[string]CountryDocuments{
	"NG": {Types: []string{"NIN_SLIP", "IDENTITY_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"}, Enhanced: true},
	"GH": {Types: []string{"GHANA_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"}, Enhanced: true},
	"KE": {Types: []string{"NATIONAL_ID", "PASSPORT", "ALIEN_CARD"}, Enhanced: true},
	"ZA": {Types: []string{"NATIONAL_ID", "GREEN_BOOK", "PASSPORT"}, Enhanced: true},
}

var fallbackDocuments = CountryDocuments{Types: []string{"PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"}}

func DocumentsForCountry(country string) CountryDocuments {
	if documents, found := SupportedDocuments[country]; found {
		return documents
	}
	return fallbackDocuments
}

func SmileProductFor(country, documentType string) (string, bool) {
	documents := DocumentsForCountry(country)
	if !slices.Contains(documents.Types, documentType) {
		return "", false
	}
	if documents.Enhanced {
		return "enhanced_document_verification", true
	}
	return "doc_verification", true
}

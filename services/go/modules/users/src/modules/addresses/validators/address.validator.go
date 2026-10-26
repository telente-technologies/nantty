package validators

import (
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/modules/addresses/dtos"
	"nantty/modules/users/src/modules/addresses/models"
	"nantty/modules/users/src/modules/addresses/services"
	"nantty/modules/users/src/utils"
)

func text(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func optionalUuid(collector *utils.IssueCollector, path string, value *string) *uuid.UUID {
	trimmed := text(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		collector.Add(path, "must be an identifier")
		return nil
	}
	return &parsed
}

func validateOptionalTexts(collector *utils.IssueCollector, request dtos.AddressRequest) {
	collector.RequireLength("label", text(request.Label), 0, 40)
	collector.RequireLength("line2", text(request.Line2), 0, 160)
	collector.RequireLength("details", text(request.Details), 0, 300)
	collector.RequireLength("city", text(request.City), 0, 80)
	collector.RequireLength("state", text(request.State), 0, 80)
}

func buildGeoSelection(collector *utils.IssueCollector, request dtos.AddressRequest) models.GeoSelection {
	collector.RequireLength("countryId", text(request.CountryId), 2, 36)
	return models.GeoSelection{
		CountryIdentifier: text(request.CountryId),
		StateId:           optionalUuid(collector, "stateId", request.StateId),
		LgaId:             optionalUuid(collector, "lgaId", request.LgaId),
		CityId:            optionalUuid(collector, "cityId", request.CityId),
		FreeTextCity:      text(request.City),
		FreeTextState:     text(request.State),
	}
}

func ValidateCreateAddressRequest(request dtos.AddressRequest) (models.AddressInput, error) {
	collector := &utils.IssueCollector{}
	collector.RequireLength("fullName", text(request.FullName), 2, 80)
	collector.RequireLength("line1", text(request.Line1), 3, 160)
	phone, phoneValid := services.NormalizePhoneToE164(text(request.Phone))
	if !phoneValid {
		collector.Add("phone", "must be an international phone number such as +2348012345678")
	}
	validateOptionalTexts(collector, request)
	input := models.AddressInput{
		Label: text(request.Label), FullName: text(request.FullName), Phone: phone, Line1: text(request.Line1), Line2: text(request.Line2),
		PostalCode: text(request.PostalCode), Details: text(request.Details), IsDefault: request.IsDefault != nil && *request.IsDefault,
		Geo: buildGeoSelection(collector, request),
	}
	return input, collector.Result()
}

func ValidateUpdateAddressRequest(request dtos.AddressRequest) (models.AddressPatch, error) {
	collector := &utils.IssueCollector{}
	patch := models.AddressPatch{IsDefault: request.IsDefault}
	assignTrimmed := func(destination **string, source *string, path string, minimum, maximum int) {
		if source == nil {
			return
		}
		trimmed := strings.TrimSpace(*source)
		collector.RequireLength(path, trimmed, minimum, maximum)
		*destination = &trimmed
	}
	assignTrimmed(&patch.FullName, request.FullName, "fullName", 2, 80)
	assignTrimmed(&patch.Line1, request.Line1, "line1", 3, 160)
	assignTrimmed(&patch.Label, request.Label, "label", 0, 40)
	assignTrimmed(&patch.Line2, request.Line2, "line2", 0, 160)
	assignTrimmed(&patch.Details, request.Details, "details", 0, 300)
	assignTrimmed(&patch.PostalCode, request.PostalCode, "postalCode", 0, 12)
	if request.Phone != nil {
		phone, phoneValid := services.NormalizePhoneToE164(text(request.Phone))
		if !phoneValid {
			collector.Add("phone", "must be an international phone number such as +2348012345678")
		}
		patch.Phone = &phone
	}
	if request.CountryId != nil {
		selection := buildGeoSelection(collector, request)
		patch.Geo = &selection
	} else if request.StateId != nil || request.LgaId != nil || request.CityId != nil {
		collector.Add("countryId", "is required when changing the location")
	}
	return patch, collector.Result()
}

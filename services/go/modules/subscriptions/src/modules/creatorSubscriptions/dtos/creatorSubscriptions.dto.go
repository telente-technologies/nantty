package dtos

import (
	"bytes"
	"encoding/json"
	"errors"

	"zudomart/modules/subscriptions/src/models"
)

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type BenefitDto models.CreatorPlanBenefit

func (benefit *BenefitDto) UnmarshalJSON(raw []byte) error {
	if len(raw) > 0 && raw[0] == '"' {
		return json.Unmarshal(raw, &benefit.Name)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var object struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decoder.Decode(&object); err != nil {
		return errors.New("benefits must be text or {name, description}")
	}
	benefit.Name, benefit.Description = object.Name, object.Description
	return nil
}

type CreatePlanRequestDto struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Price       MoneyDto     `json:"price"`
	Interval    string       `json:"interval"`
	Benefits    []BenefitDto `json:"benefits"`
}

type UpdatePlanRequestDto struct {
	Name        *string       `json:"name"`
	Description *string       `json:"description"`
	Benefits    *[]BenefitDto `json:"benefits"`
	Active      *bool         `json:"active"`
}

type StartSubscriptionRequestDto struct {
	PlanId   string `json:"planId"`
	Provider string `json:"provider"`
	ReturnTo string `json:"returnTo"`
}

type VerifySubscriptionRequestDto struct {
	Reference string `json:"reference"`
}

func ConvertBenefits(benefits []BenefitDto) []models.CreatorPlanBenefit {
	converted := make([]models.CreatorPlanBenefit, 0, len(benefits))
	for _, benefit := range benefits {
		converted = append(converted, models.CreatorPlanBenefit(benefit))
	}
	return converted
}

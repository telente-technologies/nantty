package dtos

import "nantty/platform/money"

type DeliveryAreaView struct {
	Id               string      `json:"id"`
	Name             string      `json:"name"`
	State            string      `json:"state"`
	Cities           []string    `json:"cities"`
	Fee              money.Money `json:"fee"`
	EstimatedDaysMin int         `json:"estimatedDaysMin"`
	EstimatedDaysMax int         `json:"estimatedDaysMax"`
	Active           bool        `json:"active"`
}

type DeliveryAreaInput struct {
	Name             *string   `json:"name"`
	State            *string   `json:"state"`
	Cities           *[]string `json:"cities"`
	FeeMinor         *int64    `json:"feeMinor"`
	EstimatedDaysMin *int      `json:"estimatedDaysMin"`
	EstimatedDaysMax *int      `json:"estimatedDaysMax"`
	Active           *bool     `json:"active"`
}

type DeliveryAreaValues struct {
	Name             string
	State            string
	Cities           []string
	FeeMinor         int64
	EstimatedDaysMin int
	EstimatedDaysMax int
	Active           bool
}

func (input DeliveryAreaInput) MergedOver(current DeliveryAreaValues) DeliveryAreaValues {
	merged := current
	if input.Name != nil {
		merged.Name = *input.Name
	}
	if input.State != nil {
		merged.State = *input.State
	}
	if input.Cities != nil {
		merged.Cities = *input.Cities
	}
	if input.FeeMinor != nil {
		merged.FeeMinor = *input.FeeMinor
	}
	if input.EstimatedDaysMin != nil {
		merged.EstimatedDaysMin = *input.EstimatedDaysMin
	}
	if input.EstimatedDaysMax != nil {
		merged.EstimatedDaysMax = *input.EstimatedDaysMax
	}
	if input.Active != nil {
		merged.Active = *input.Active
	}
	return merged
}

func (input DeliveryAreaInput) IsComplete() bool {
	return input.Name != nil && input.State != nil && input.Cities != nil && input.FeeMinor != nil && input.EstimatedDaysMin != nil && input.EstimatedDaysMax != nil && input.Active != nil
}

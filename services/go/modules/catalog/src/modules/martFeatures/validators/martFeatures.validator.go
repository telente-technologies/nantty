package validators

import (
	"zudomart/modules/catalog/src/modules/martFeatures/dtos"
	"zudomart/modules/catalog/src/utils"
)

func ValidateFeatureReason(request dtos.FeatureRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("reason", request.Reason, 5, 1000)
	return issues.AsError()
}

func ValidateReason(request dtos.ReasonRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("reason", request.Reason, 5, 1000)
	return issues.AsError()
}

func ValidateMove(request dtos.MoveRequest) error {
	issues := utils.Issues{}
	if request.Direction != "up" && request.Direction != "down" {
		issues.Add("direction", "must be up or down")
	}
	return issues.AsError()
}

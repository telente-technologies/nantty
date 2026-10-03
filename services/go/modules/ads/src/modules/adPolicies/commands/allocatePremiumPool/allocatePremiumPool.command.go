package allocatepremiumpool

import (
	"regexp"

	"zudomart/modules/ads/src/modules/adPolicies/dtos"
	"zudomart/platform/httpserver"
)

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

type Command struct{ Request dtos.PremiumPoolRequest }

func (command Command) Validate() error {
	request := command.Request
	if !monthPattern.MatchString(request.Month) || len(request.Currency) != 3 || request.PoolMinor <= 0 || len(request.Consumption) == 0 || len(request.Consumption) > 50_000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "body", Message: "month (YYYY-MM), currency, poolMinor and 1-50000 consumption rows are required"}})
	}
	return nil
}

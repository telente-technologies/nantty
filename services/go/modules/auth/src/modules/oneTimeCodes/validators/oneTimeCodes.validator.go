package validators

import (
	"nantty/modules/auth/src/modules/oneTimeCodes/dtos"
	"nantty/modules/auth/src/utils"
)

var oneTimeCodePurposes = []string{"signup", "reset", "login"}

func ValidateSendOneTimeCodeRequest(request dtos.SendOneTimeCodeRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("destination", request.Destination, 3, 254)
	collector.RequireOneOf("purpose", request.Purpose, oneTimeCodePurposes)
	return collector.Result()
}

func ValidateVerifyOneTimeCodeRequest(request dtos.VerifyOneTimeCodeRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("destination", request.Destination, 3, 254)
	collector.RequirePattern("code", request.Code, utils.SixDigitCodePattern)
	collector.RequireOneOf("purpose", request.Purpose, oneTimeCodePurposes)
	return collector.Result()
}

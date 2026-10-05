package validators

import (
	"zudomart/modules/auth/src/modules/emailVerification/dtos"
	"zudomart/modules/auth/src/utils"
)

func ValidateConfirmEmailVerificationRequest(request dtos.ConfirmEmailVerificationRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequirePattern("code", request.Code, utils.SixDigitCodePattern)
	return collector.Result()
}

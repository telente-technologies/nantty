package validators

import (
	"nantty/modules/auth/src/modules/emailVerification/dtos"
	"nantty/modules/auth/src/utils"
)

func ValidateConfirmEmailVerificationRequest(request dtos.ConfirmEmailVerificationRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequirePattern("code", request.Code, utils.SixDigitCodePattern)
	return collector.Result()
}

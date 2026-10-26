package validators

import (
	"nantty/modules/auth/src/modules/passwords/dtos"
	"nantty/modules/auth/src/utils"
)

func ValidateResetPasswordRequest(request dtos.ResetPasswordRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("otpToken", request.OtpToken, utils.OpaqueTokenMinLength, utils.OpaqueTokenMaxLength)
	collector.RequireLength("password", request.Password, 1, 128)
	return collector.Result()
}

func ValidateChangePasswordRequest(request dtos.ChangePasswordRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("currentPassword", request.CurrentPassword, 0, 128)
	collector.RequireLength("newPassword", request.NewPassword, 1, 128)
	return collector.Result()
}

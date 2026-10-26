package validators

import (
	"nantty/modules/auth/src/modules/registration/dtos"
	"nantty/modules/auth/src/utils"
)

func ValidateRegisterRequest(request dtos.RegisterRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("email", request.Email, 3, 254)
	collector.RequireLength("password", request.Password, 1, 128)
	collector.RequireLength("birthday", request.Birthday, 10, 10)
	collector.RequireLength("username", request.Username, 0, 31)
	collector.RequireLength("name", request.Name, 0, 80)
	collector.RequireLength("otpToken", request.OtpToken, utils.OpaqueTokenMinLength, utils.OpaqueTokenMaxLength)
	return collector.Result()
}

func ValidateAddBirthdayRequest(request dtos.AddBirthdayRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("birthday", request.Birthday, 10, 10)
	return collector.Result()
}

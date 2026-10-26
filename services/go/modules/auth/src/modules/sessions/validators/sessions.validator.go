package validators

import (
	"nantty/modules/auth/src/modules/sessions/dtos"
	"nantty/modules/auth/src/utils"
)

func ValidateLogInRequest(request dtos.LogInRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("identifier", request.Identifier, 3, 254)
	collector.RequireLength("password", request.Password, 1, 128)
	return collector.Result()
}

func ValidateRefreshRequest(request dtos.RefreshRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("refreshToken", request.RefreshToken, utils.OpaqueTokenMinLength, utils.OpaqueTokenMaxLength)
	return collector.Result()
}

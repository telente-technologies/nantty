package validators

import (
	"zudomart/modules/admin/src/modules/staffAuth/dtos"
	"zudomart/modules/admin/src/utils/validation"
)

func ValidateLogInRequest(request dtos.LogInRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("email", request.Email, 3, 254)
	collector.RequireLength("password", request.Password, 1, 128)
	return collector.Result()
}

func ValidateChallengeRequest(request dtos.ChallengeRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("challengeToken", request.ChallengeToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	return collector.Result()
}

func ValidateChallengeCodeRequest(request dtos.ChallengeCodeRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("challengeToken", request.ChallengeToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	collector.RequireSixDigitCode("code", request.Code)
	return collector.Result()
}

func ValidateRefreshRequest(request dtos.RefreshRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("refreshToken", request.RefreshToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	return collector.Result()
}

func ValidateStepUpRequest(request dtos.StepUpRequest) error {
	collector := &validation.Collector{}
	collector.RequireSixDigitCode("code", request.Code)
	return collector.Result()
}

func ValidateAcceptInvitationRequest(request dtos.AcceptInvitationRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("token", request.Token, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	collector.RequireLength("password", request.Password, 1, 128)
	return collector.Result()
}

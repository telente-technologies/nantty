package validators

import (
	"regexp"

	"nantty/modules/admin/src/modules/staffAuth/dtos"
	recoverycodes "nantty/modules/admin/src/utils/recoveryCodes"
	"nantty/modules/admin/src/utils/validation"
)

var sixDigitCode = regexp.MustCompile(`^\d{6}$`)

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

func ResolveSecondFactorMethod(method, code string) string {
	switch method {
	case "totp", "recovery", "webauthn":
		return method
	case "":
		if code != "" && !sixDigitCode.MatchString(code) && recoverycodes.LooksLikeRecoveryCode(code) {
			return "recovery"
		}
		return "totp"
	}
	return method
}

func requireSecondFactorProof(collector *validation.Collector, method, code string, credential []byte, allowRecovery bool) {
	switch ResolveSecondFactorMethod(method, code) {
	case "totp":
		collector.RequireSixDigitCode("code", code)
	case "recovery":
		collector.RequireTrue("code", allowRecovery && recoverycodes.LooksLikeRecoveryCode(code), "must be one of your recovery codes")
	case "webauthn":
		collector.RequireTrue("credential", len(credential) > 2 && len(credential) <= 16384 && code == "", "must be a passkey response")
	default:
		collector.RequireTrue("method", false, "must be totp, recovery or webauthn")
	}
}

func ValidateChallengeCodeRequest(request dtos.ChallengeCodeRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("challengeToken", request.ChallengeToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	requireSecondFactorProof(collector, request.Method, request.Code, request.Credential, true)
	return collector.Result()
}

func ValidateEnrollmentConfirmRequest(request dtos.ChallengeCodeRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("challengeToken", request.ChallengeToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	collector.RequireTrue("method", request.Method == "" || request.Method == "totp", "must be totp")
	collector.RequireSixDigitCode("code", request.Code)
	return collector.Result()
}

func ValidatePasskeyOptionsRequest(request dtos.PasskeyOptionsRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("challengeToken", request.Token(), validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	return collector.Result()
}

func ValidatePreferencesRequest(request dtos.PreferencesRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("theme", request.Theme == "light" || request.Theme == "dark" || request.Theme == "system", "must be light, dark or system")
	return collector.Result()
}

func ValidateRefreshRequest(request dtos.RefreshRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("refreshToken", request.RefreshToken, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	return collector.Result()
}

func ValidateStepUpRequest(request dtos.StepUpRequest) error {
	collector := &validation.Collector{}
	requireSecondFactorProof(collector, request.Method, request.Code, request.Credential, false)
	return collector.Result()
}

func ValidateAcceptInvitationRequest(request dtos.AcceptInvitationRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("token", request.Token, validation.OpaqueTokenMinimum, validation.OpaqueTokenMaximum)
	collector.RequireLength("password", request.Password, 1, 128)
	return collector.Result()
}

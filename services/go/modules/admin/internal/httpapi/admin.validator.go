package httpapi

import (
	"regexp"

	"zudomart/platform/httpserver"
)

var (
	sixDigitCodePattern = regexp.MustCompile(`^\d{6}$`)
	opaqueTokenMinimum  = 20
	opaqueTokenMaximum  = 512
)

type issueCollector struct {
	issues []httpserver.ValidationIssue
}

func (collector *issueCollector) requireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid length"})
	}
}

func (collector *issueCollector) requireCode(path, value string) {
	if !sixDigitCodePattern.MatchString(value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "must be a six digit code"})
	}
}

func (collector *issueCollector) requireTrue(path string, condition bool, message string) {
	if !condition {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: message})
	}
}

func (collector *issueCollector) result() error {
	if len(collector.issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.issues)
}

func ValidateLogInRequest(request LogInRequest) error {
	collector := &issueCollector{}
	collector.requireLength("email", request.Email, 3, 254)
	collector.requireLength("password", request.Password, 1, 128)
	return collector.result()
}

func ValidateChallengeRequest(request ChallengeRequest) error {
	collector := &issueCollector{}
	collector.requireLength("challengeToken", request.ChallengeToken, opaqueTokenMinimum, opaqueTokenMaximum)
	return collector.result()
}

func ValidateChallengeCodeRequest(request ChallengeCodeRequest) error {
	collector := &issueCollector{}
	collector.requireLength("challengeToken", request.ChallengeToken, opaqueTokenMinimum, opaqueTokenMaximum)
	collector.requireCode("code", request.Code)
	return collector.result()
}

func ValidateRefreshRequest(request RefreshRequest) error {
	collector := &issueCollector{}
	collector.requireLength("refreshToken", request.RefreshToken, opaqueTokenMinimum, opaqueTokenMaximum)
	return collector.result()
}

func ValidateStepUpRequest(request StepUpRequest) error {
	collector := &issueCollector{}
	collector.requireCode("code", request.Code)
	return collector.result()
}

func ValidateAcceptInvitationRequest(request AcceptInvitationRequest) error {
	collector := &issueCollector{}
	collector.requireLength("token", request.Token, opaqueTokenMinimum, opaqueTokenMaximum)
	collector.requireLength("password", request.Password, 1, 128)
	return collector.result()
}

func ValidateInviteStaffRequest(request InviteStaffRequest) error {
	collector := &issueCollector{}
	collector.requireLength("email", request.Email, 3, 254)
	collector.requireLength("displayName", request.DisplayName, 0, 80)
	collector.requireTrue("permissions", len(request.Permissions) <= 40, "has too many entries")
	return collector.result()
}

func ValidateChangePermissionsRequest(request ChangePermissionsRequest) error {
	collector := &issueCollector{}
	collector.requireTrue("permissions", request.Permissions != nil && len(request.Permissions) <= 40, "must be a list of up to 40 entries")
	return collector.result()
}

func ValidateUpdateSettingRequest(request UpdateSettingRequest) error {
	collector := &issueCollector{}
	collector.requireTrue("value", len(request.Value) > 0, "is required")
	collector.requireTrue("expectedVersion", request.ExpectedVersion > 0, "must be a positive integer")
	collector.requireLength("reason", request.Reason, 5, 500)
	return collector.result()
}

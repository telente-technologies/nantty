package httpapi

import (
	"regexp"
	"slices"

	"zudomart/platform/httpserver"
)

var (
	sixDigitCodePattern  = regexp.MustCompile(`^\d{6}$`)
	oneTimeCodePurposes  = []string{"signup", "reset", "login"}
	opaqueTokenMinLength = 20
	opaqueTokenMaxLength = 512
)

type issueCollector struct {
	issues []httpserver.ValidationIssue
}

func (collector *issueCollector) requireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid length"})
	}
}

func (collector *issueCollector) requireOneOf(path, value string, allowed []string) {
	if !slices.Contains(allowed, value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "is not an allowed value"})
	}
}

func (collector *issueCollector) requirePattern(path, value string, pattern *regexp.Regexp) {
	if !pattern.MatchString(value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid format"})
	}
}

func (collector *issueCollector) result() error {
	if len(collector.issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.issues)
}

func ValidateRegisterRequest(request RegisterRequest) error {
	collector := &issueCollector{}
	collector.requireLength("email", request.Email, 3, 254)
	collector.requireLength("password", request.Password, 1, 128)
	collector.requireLength("birthday", request.Birthday, 10, 10)
	collector.requireLength("username", request.Username, 0, 31)
	collector.requireLength("name", request.Name, 0, 80)
	collector.requireLength("otpToken", request.OtpToken, opaqueTokenMinLength, opaqueTokenMaxLength)
	return collector.result()
}

func ValidateLogInRequest(request LogInRequest) error {
	collector := &issueCollector{}
	collector.requireLength("identifier", request.Identifier, 3, 254)
	collector.requireLength("password", request.Password, 1, 128)
	return collector.result()
}

func ValidateRefreshRequest(request RefreshRequest) error {
	collector := &issueCollector{}
	collector.requireLength("refreshToken", request.RefreshToken, opaqueTokenMinLength, opaqueTokenMaxLength)
	return collector.result()
}

func ValidateSendOneTimeCodeRequest(request SendOneTimeCodeRequest) error {
	collector := &issueCollector{}
	collector.requireLength("destination", request.Destination, 3, 254)
	collector.requireOneOf("purpose", request.Purpose, oneTimeCodePurposes)
	return collector.result()
}

func ValidateVerifyOneTimeCodeRequest(request VerifyOneTimeCodeRequest) error {
	collector := &issueCollector{}
	collector.requireLength("destination", request.Destination, 3, 254)
	collector.requirePattern("code", request.Code, sixDigitCodePattern)
	collector.requireOneOf("purpose", request.Purpose, oneTimeCodePurposes)
	return collector.result()
}

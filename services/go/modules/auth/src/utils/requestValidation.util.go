package utils

import (
	"net/http"
	"regexp"
	"slices"

	"nantty/platform/httpserver"
)

var SixDigitCodePattern = regexp.MustCompile(`^\d{6}$`)

const (
	OpaqueTokenMinLength = 20
	OpaqueTokenMaxLength = 512
)

type IssueCollector struct {
	issues []httpserver.ValidationIssue
}

func (collector *IssueCollector) RequireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid length"})
	}
}

func (collector *IssueCollector) RequireOneOf(path, value string, allowed []string) {
	if !slices.Contains(allowed, value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "is not an allowed value"})
	}
}

func (collector *IssueCollector) RequirePattern(path, value string, pattern *regexp.Regexp) {
	if !pattern.MatchString(value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid format"})
	}
}

func (collector *IssueCollector) Result() error {
	if len(collector.issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.issues)
}

func DecodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func DerefOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

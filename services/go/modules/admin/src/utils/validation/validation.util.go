package validation

import (
	"regexp"

	"nantty/platform/httpserver"
)

var sixDigitCodePattern = regexp.MustCompile(`^\d{6}$`)

const (
	OpaqueTokenMinimum = 20
	OpaqueTokenMaximum = 512
)

type Collector struct {
	issues []httpserver.ValidationIssue
}

func (collector *Collector) RequireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "has an invalid length"})
	}
}

func (collector *Collector) RequireSixDigitCode(path, value string) {
	if !sixDigitCodePattern.MatchString(value) {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: "must be a six digit code"})
	}
}

func (collector *Collector) RequireTrue(path string, condition bool, message string) {
	if !condition {
		collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: message})
	}
}

func (collector *Collector) Result() error {
	if len(collector.issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.issues)
}

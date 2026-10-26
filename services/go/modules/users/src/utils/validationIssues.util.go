package utils

import (
	"regexp"
	"slices"

	"nantty/platform/httpserver"
)

type IssueCollector struct {
	issues []httpserver.ValidationIssue
}

func (collector *IssueCollector) Add(path, message string) {
	collector.issues = append(collector.issues, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collector *IssueCollector) RequireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.Add(path, "has an invalid length")
	}
}

func (collector *IssueCollector) RequirePattern(path, value string, pattern *regexp.Regexp) {
	if !pattern.MatchString(value) {
		collector.Add(path, "has an invalid format")
	}
}

func (collector *IssueCollector) RequireOneOf(path, value string, allowed []string) {
	if !slices.Contains(allowed, value) {
		collector.Add(path, "is not an allowed value")
	}
}

func (collector *IssueCollector) Result() error {
	if len(collector.issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.issues)
}

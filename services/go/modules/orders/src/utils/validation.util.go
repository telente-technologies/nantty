package utils

import (
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/platform/httpserver"
)

type Issues []httpserver.ValidationIssue

func (collected *Issues) Add(path, message string) {
	*collected = append(*collected, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collected Issues) AsError() error {
	if len(collected) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collected)
}

func ParseIdentifiers(path string, values []string, collected *Issues) []uuid.UUID {
	parsed := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		identifier, err := uuid.Parse(value)
		if err != nil {
			collected.Add(path, "must contain valid ids")
			continue
		}
		parsed = append(parsed, identifier)
	}
	return parsed
}

func ParseIdentifier(path, value string, collected *Issues) uuid.UUID {
	identifier, err := uuid.Parse(value)
	if err != nil {
		collected.Add(path, "must be a valid id")
	}
	return identifier
}

func (collected *Issues) CheckLength(path, value string, minimum, maximum int) {
	if length := len(strings.TrimSpace(value)); length < minimum || length > maximum {
		collected.Add(path, "must be between "+strconv.Itoa(minimum)+" and "+strconv.Itoa(maximum)+" characters")
	}
}

func (collected *Issues) CheckRange(path string, value, minimum, maximum int) {
	if value < minimum || value > maximum {
		collected.Add(path, "must be between "+strconv.Itoa(minimum)+" and "+strconv.Itoa(maximum))
	}
}

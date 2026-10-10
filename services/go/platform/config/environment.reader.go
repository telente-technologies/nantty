package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type EnvironmentReader struct {
	problems []string
}

func NewEnvironmentReader() *EnvironmentReader {
	return &EnvironmentReader{}
}

func (reader *EnvironmentReader) ReadRequiredString(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		reader.problems = append(reader.problems, name+" is required")
	}
	return value
}

func (reader *EnvironmentReader) ReadStringOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func (reader *EnvironmentReader) ReadIntegerOrDefault(name string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be an integer", name))
		return fallback
	}
	return value
}

func (reader *EnvironmentReader) ReadDurationOrDefault(name string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be a duration such as 15m", name))
		return fallback
	}
	if value <= 0 {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be greater than zero", name))
		return fallback
	}
	return value
}

func (reader *EnvironmentReader) ReadCommaSeparatedListOrDefault(name string, fallback []string) []string {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	var values []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func (reader *EnvironmentReader) RequireMinimumLength(name, value string, minimum int) {
	if value != "" && len(value) < minimum {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be at least %d characters", name, minimum))
	}
}

func (reader *EnvironmentReader) ReportProblem(problem string) {
	reader.problems = append(reader.problems, problem)
}

func (reader *EnvironmentReader) CombinedConfigurationError() error {
	if len(reader.problems) == 0 {
		return nil
	}
	return errors.New("invalid configuration: " + strings.Join(reader.problems, "; "))
}

package config

import (
	"encoding/base64"
	"os"
	"slices"
	"sort"
	"strings"
)

var secretNameFragments = []string{"TOKEN", "SECRET", "KEY", "PEPPER", "PASSWORD"}

var knownExampleSecretValues = []string{"test", "devkey", "secret", "changeme", "change_me", "password", "example"}

func (reader *EnvironmentReader) RejectPlaceholderSecrets(environment []string) {
	offending := []string{}
	for _, entry := range environment {
		name, value, found := strings.Cut(entry, "=")
		if !found || !looksLikeSecretName(name) {
			continue
		}
		if IsPlaceholderSecretValue(value) {
			offending = append(offending, name)
		}
	}
	sort.Strings(offending)
	for _, name := range offending {
		reader.ReportProblem(name + " holds a local or example placeholder value, which is refused in production")
	}
}

func (reader *EnvironmentReader) RejectPlaceholderSecretsInProcessEnvironment() {
	reader.RejectPlaceholderSecrets(os.Environ())
}

func IsPlaceholderSecretValue(value string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if trimmed == "" {
		return false
	}
	if strings.HasPrefix(trimmed, "local-only") || slices.Contains(knownExampleSecretValues, trimmed) {
		return true
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(value))
	return err == nil && strings.HasPrefix(strings.ToLower(string(decoded)), "local-only")
}

func looksLikeSecretName(name string) bool {
	upper := strings.ToUpper(name)
	if strings.HasSuffix(upper, "_KEY_ID") || strings.HasSuffix(upper, "_PATH") || strings.HasSuffix(upper, "_URL") || strings.HasSuffix(upper, "_ARN") {
		return false
	}
	for _, fragment := range secretNameFragments {
		if strings.Contains(upper, fragment) {
			return true
		}
	}
	return false
}

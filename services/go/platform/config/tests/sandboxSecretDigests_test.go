package config_test

import (
	"bufio"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"nantty/platform/config"
)

func TestRejectPlaceholderSecretsRefusesEverySandboxValue(t *testing.T) {
	file, err := os.Open(filepath.Join("..", "..", "..", "..", "..", "security", "regression", "sandboxSecrets.env"))
	if err != nil {
		t.Fatalf("sandbox secrets file must stay readable for this check: %v", err)
	}
	defer file.Close()
	entries := []string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			entries = append(entries, line)
		}
	}
	if err := scanner.Err(); err != nil || len(entries) == 0 {
		t.Fatalf("sandbox secrets file must list entries: %v", err)
	}
	reader := config.NewEnvironmentReader()
	reader.RejectPlaceholderSecrets(entries)
	configurationError := reader.CombinedConfigurationError()
	if configurationError == nil {
		t.Fatal("all recognized sandbox secret placeholders must be refused")
	}
	for _, entry := range entries {
		name, _, _ := strings.Cut(entry, "=")
		upperName := strings.ToUpper(name)
		if strings.HasSuffix(upperName, "_KEY_ID") || strings.HasSuffix(upperName, "_PATH") || strings.HasSuffix(upperName, "_URL") || strings.HasSuffix(upperName, "_ARN") {
			continue
		}
		if strings.Contains(upperName, "SECRET") || strings.Contains(upperName, "TOKEN") || strings.Contains(upperName, "KEY") || strings.Contains(upperName, "PASSWORD") || strings.Contains(upperName, "PEPPER") {
			if !strings.Contains(configurationError.Error(), name) {
				t.Errorf("%s: sandbox placeholder is not rejected", name)
			}
		}
	}
}

func TestPlaceholderDetectionDecodesUnpaddedBase64(t *testing.T) {
	for _, encoding := range []*base64.Encoding{base64.RawStdEncoding, base64.RawURLEncoding} {
		value := encoding.EncodeToString([]byte("local-only-unpadded-key-material-00"))
		if !config.IsPlaceholderSecretValue(value) {
			t.Fatalf("unpadded base64 of a local-only value must be refused")
		}
	}
}

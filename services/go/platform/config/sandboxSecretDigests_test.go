package config

import (
	"bufio"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRejectPlaceholderSecretsRefusesEverySandboxValue(t *testing.T) {
	file, err := os.Open(filepath.Join("..", "..", "..", "..", "security", "regression", "sandboxSecrets.env"))
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
	for _, entry := range entries {
		name, value, _ := strings.Cut(entry, "=")
		if !looksLikeSecretName(name) {
			continue
		}
		if !IsPlaceholderSecretValue(value) {
			t.Errorf("%s: the sandbox value must be refused in production; regenerate sandboxSecretDigests.go", name)
		}
		if !isSandboxSecretValue(value) {
			t.Errorf("%s: the sandbox value is missing from sandboxSecretValueDigests", name)
		}
	}
}

func TestPlaceholderDetectionDecodesUnpaddedBase64(t *testing.T) {
	for _, encoding := range []*base64.Encoding{base64.RawStdEncoding, base64.RawURLEncoding} {
		value := encoding.EncodeToString([]byte("local-only-unpadded-key-material-00"))
		if !IsPlaceholderSecretValue(value) {
			t.Fatalf("unpadded base64 of a local-only value must be refused")
		}
	}
}

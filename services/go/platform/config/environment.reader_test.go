package config

import (
	"os"
	"testing"
	"time"
)

func TestReadDurationOrDefaultRejectsNonPositiveValues(t *testing.T) {
	const key = "TEST_DURATION_SETTING"
	for _, raw := range []string{"0", "-1s"} {
		t.Run(raw, func(t *testing.T) {
			if err := os.Setenv(key, raw); err != nil {
				t.Fatal(err)
			}
			defer func() { _ = os.Unsetenv(key) }()

			reader := NewEnvironmentReader()
			got := reader.ReadDurationOrDefault(key, 5*time.Second)
			if got != 5*time.Second {
				t.Fatalf("duration = %s, want fallback %s", got, 5*time.Second)
			}
			if err := reader.CombinedConfigurationError(); err == nil {
				t.Fatal("non-positive duration should be reported as invalid configuration")
			}
		})
	}
}

func TestReadDurationOrDefaultAcceptsPositiveValues(t *testing.T) {
	const key = "TEST_DURATION_SETTING"
	if err := os.Setenv(key, "250ms"); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Unsetenv(key) }()

	reader := NewEnvironmentReader()
	if got := reader.ReadDurationOrDefault(key, time.Second); got != 250*time.Millisecond {
		t.Fatalf("duration = %s, want 250ms", got)
	}
	if err := reader.CombinedConfigurationError(); err != nil {
		t.Fatalf("unexpected configuration error: %v", err)
	}
}

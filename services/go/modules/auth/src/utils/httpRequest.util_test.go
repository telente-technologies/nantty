package utils

import "testing"

func TestDeviceIdsMustLookLikeGeneratedIdentifiers(t *testing.T) {
	cases := map[string]string{
		"7f4c1a2e-9b0d-4c3e-8f61-2a5b7c9d0e1f": "7f4c1a2e-9b0d-4c3e-8f61-2a5b7c9d0e1f",
		"  android:abc123XYZ  ":                "android:abc123XYZ",
		"short":                                "",
		"has spaces in it here":                "",
		"<script>alert(1)</script>":            "",
		"evil\nInjected-Log-Line":              "",
	}
	for raw, want := range cases {
		if got := NormalizeDeviceId(raw); got != want {
			t.Fatalf("NormalizeDeviceId(%q) = %q, want %q", raw, got, want)
		}
	}
}

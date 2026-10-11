package controllers

import (
	"encoding/json"
	"testing"
)

func TestReplyRejectsEveryPlaintextField(t *testing.T) {
	cases := map[string]string{
		"body":          `{"body":"Your order shipped"}`,
		"text":          `{"text":"hi"}`,
		"location":      `{"location":{"latitude":6.5,"longitude":3.3}}`,
		"poll":          `{"poll":{"question":"q","options":["a","b"]}}`,
		"document":      `{"document":{"fileName":"invoice.pdf"}}`,
		"sharedContent": `{"sharedContent":{"kind":"product","id":"p1"}}`,
	}
	for name, raw := range cases {
		var request replyRequest
		if err := json.Unmarshal([]byte(raw), &request); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if !request.carriesPlaintext() {
			t.Errorf("%s should be rejected as plaintext", name)
		}
	}
	var encrypted replyRequest
	if err := json.Unmarshal([]byte(`{"kind":"text","encryption":{"deviceId":"d","ciphertext":"x"},"body":"","location":null}`), &encrypted); err != nil {
		t.Fatal(err)
	}
	if encrypted.carriesPlaintext() || !hasRaw(encrypted.Encryption) {
		t.Error("an encrypted reply must pass")
	}
	if errPlaintextNotAccepted.Status != 422 || errPlaintextNotAccepted.Code != "PLAINTEXT_NOT_ACCEPTED" {
		t.Errorf("unexpected error %+v", errPlaintextNotAccepted)
	}
}

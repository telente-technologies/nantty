package controllers

import (
	"strings"
	"testing"
)

func TestDecodeLiveCoinSupportRequest(t *testing.T) {
	for _, test := range []struct {
		name    string
		body    string
		want    bool
		wantErr bool
	}{
		{name: "enabled", body: `{"enabled":true}`, want: true},
		{name: "disabled", body: `{"enabled":false}`},
		{name: "missing", body: `{}`, wantErr: true},
		{name: "null is not a boolean", body: `{"enabled":null}`, wantErr: true},
		{name: "string is not a boolean", body: `{"enabled":"true"}`, wantErr: true},
		{name: "unknown field", body: `{"enabled":true,"other":false}`, wantErr: true},
		{name: "duplicate field", body: `{"enabled":true,"enabled":false}`, wantErr: true},
		{name: "non-object", body: `true`, wantErr: true},
		{name: "trailing JSON", body: `{"enabled":true}{"enabled":false}`, wantErr: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := decodeLiveCoinSupportRequest(strings.NewReader(test.body))
			if (err != nil) != test.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, test.wantErr)
			}
			if err == nil && got != test.want {
				t.Fatalf("enabled = %v, want %v", got, test.want)
			}
		})
	}
}

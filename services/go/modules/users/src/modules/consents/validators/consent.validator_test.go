package validators

import (
	"testing"

	"nantty/modules/users/src/modules/consents/dtos"
)

func TestValidateSetConsentsRequest(t *testing.T) {
	device := "abcdefghijklmnop1234"
	short := "short"
	cases := []struct {
		name          string
		request       dtos.SetConsentsRequest
		requireDevice bool
		valid         bool
	}{
		{"optional decisions", dtos.SetConsentsRequest{Decisions: map[string]bool{"analytics": true, "marketing": false}}, false, true},
		{"device required and present", dtos.SetConsentsRequest{DeviceId: &device, Decisions: map[string]bool{"analytics": true}}, true, true},
		{"device required but short", dtos.SetConsentsRequest{DeviceId: &short, Decisions: map[string]bool{"analytics": true}}, true, false},
		{"device required but missing", dtos.SetConsentsRequest{Decisions: map[string]bool{"analytics": true}}, true, false},
		{"essential cannot be withdrawn", dtos.SetConsentsRequest{Decisions: map[string]bool{"essential": false, "analytics": true}}, false, false},
		{"essential true is accepted", dtos.SetConsentsRequest{Decisions: map[string]bool{"essential": true, "analytics": true}}, false, true},
		{"only essential is empty", dtos.SetConsentsRequest{Decisions: map[string]bool{"essential": true}}, false, false},
		{"unknown type", dtos.SetConsentsRequest{Decisions: map[string]bool{"tracking": true}}, false, false},
		{"empty", dtos.SetConsentsRequest{}, false, false},
	}
	for _, testCase := range cases {
		if err := ValidateSetConsentsRequest(testCase.request, testCase.requireDevice); (err == nil) != testCase.valid {
			t.Errorf("%s: err=%v want valid=%v", testCase.name, err, testCase.valid)
		}
	}
}

func TestDeviceIdPattern(t *testing.T) {
	for id, valid := range map[string]bool{"abcdefghijklmnop": true, "ABC_def-1234567890xyz": true, "abcdefghijklmno": false, "has space in it 1234": false, "ünïcode-device-id-123": false} {
		if IsValidDeviceId(id) != valid {
			t.Errorf("%q valid=%v", id, !valid)
		}
	}
}

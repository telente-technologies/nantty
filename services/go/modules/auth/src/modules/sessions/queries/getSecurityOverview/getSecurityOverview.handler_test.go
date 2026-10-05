package getsecurityoverview

import "testing"

func TestUserAgentsBecomeReadableDevicesAndIpAddressesAreMasked(t *testing.T) {
	cases := map[string][2]string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36": {"Chrome on Windows", "dashboard"},
		"Zudomart/1.0 (iPhone; iOS 18.1) CFNetwork": {"Zudomart app on iPhone", "mobile_app"},
		"okhttp/4.12.0": {"Zudomart app on Android", "mobile_app"},
	}
	for userAgent, want := range cases {
		if device, app := DescribeUserAgent(userAgent); device != want[0] || app != want[1] {
			t.Errorf("%s: got %s/%s", userAgent, device, app)
		}
	}
	if MaskIpAddress("102.89.33.14") != "102.89.•••.14" || MaskIpAddress("") != "Unknown" {
		t.Fatal("ip addresses must be masked")
	}
}

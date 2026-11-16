package messengerauth

import (
	"regexp"

	"nantty/modules/auth/src/utils"
)

var installationIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,128}$`)

func validateCreateRequest(request CreateRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("identifier", request.Identifier, 3, 254)
	collector.RequireLength("password", request.Password, 1, 128)
	collector.RequireOneOf("platform", request.Platform, []string{"android", "ios"})
	collector.RequireLength("deviceName", request.DeviceName, 1, 120)
	collector.RequireLength("installationId", request.InstallationID, 8, 128)
	collector.RequireLength("trustedDeviceToken", request.TrustedDeviceToken, 0, utils.OpaqueTokenMaxLength)
	if request.InstallationID != "" && utils.NormalizeDeviceId(request.InstallationID) == "" {
		collector.RequirePattern("installationId", request.InstallationID, installationIDPattern)
	}
	return collector.Result()
}

func validateVerifyCodeRequest(request VerifyCodeRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequirePattern("code", request.Code, utils.SixDigitCodePattern)
	return collector.Result()
}

package validators

import (
	"net/url"
	"regexp"
	"slices"
	"time"

	"nantty/modules/users/src/modules/consents/dtos"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/utils"
)

var (
	deviceIdPattern      = regexp.MustCompile(`^[A-Za-z0-9_-]{16,128}$`)
	policyVersionPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,40}$`)
)

func IsValidDeviceId(deviceId string) bool { return deviceIdPattern.MatchString(deviceId) }

func ValidateSetConsentsRequest(request dtos.SetConsentsRequest, requireDeviceId bool) error {
	collector := &utils.IssueCollector{}
	if requireDeviceId && (request.DeviceId == nil || !IsValidDeviceId(*request.DeviceId)) {
		collector.Add("deviceId", "must be 16-128 letters, numbers, dashes or underscores")
	}
	if request.PolicyVersion != nil {
		collector.RequirePattern("policyVersion", *request.PolicyVersion, policyVersionPattern)
	}
	optional := 0
	for consentType, granted := range request.Decisions {
		switch {
		case consentType == models.TypeEssential && !granted:
			collector.Add("decisions.essential", "cannot be withdrawn")
		case consentType == models.TypeEssential:
		case slices.Contains(models.OptionalConsentTypes, consentType):
			optional++
		default:
			collector.Add("decisions."+consentType, "is not a consent type")
		}
	}
	if optional == 0 {
		collector.Add("decisions", "must include at least one consent type")
	}
	return collector.Result()
}

func ValidateMergeConsentsRequest(request dtos.MergeConsentsRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequirePattern("deviceId", request.DeviceId, deviceIdPattern)
	return collector.Result()
}

func ValidateAcceptTermsRequest(request dtos.AcceptTermsRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequirePattern("termsVersion", request.TermsVersion, policyVersionPattern)
	return collector.Result()
}

func ValidatePublishPolicyVersionRequest(request dtos.PublishPolicyVersionRequest) (time.Time, error) {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("kind", request.Kind, []string{models.PolicyPrivacy, models.PolicyCookie, models.PolicyTerms})
	collector.RequirePattern("version", request.Version, policyVersionPattern)
	collector.RequireLength("summary", request.Summary, 0, 500)
	collector.RequireLength("contentUrl", request.ContentUrl, 0, 300)
	if parsed, err := url.Parse(request.ContentUrl); request.ContentUrl != "" && (err != nil || parsed.Scheme != "https") {
		collector.Add("contentUrl", "must be an https URL")
	}
	effectiveAt, err := time.Parse(time.RFC3339, request.EffectiveAt)
	if err != nil {
		collector.Add("effectiveAt", "must be an RFC 3339 timestamp")
	}
	return effectiveAt, collector.Result()
}

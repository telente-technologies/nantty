package loaders

import (
	"net/http"
	"time"

	"zudomart/modules/ads/src/configs"
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/integrations"
	"zudomart/platform/staffaudit"
)

func completeStaffAndMoneyCollaborators(deployed *container.Container, collaborators Collaborators, settings configs.AdsSettings) {
	client := &http.Client{Timeout: 5 * time.Second}
	deployed.TopUps = collaborators.TopUps
	if deployed.TopUps == nil {
		deployed.TopUps = integrations.UnavailableTopUpGateway{}
		if settings.MoneyHttpUrl != "" {
			deployed.TopUps = integrations.HttpMoneyTopUpGateway{BaseUrl: settings.MoneyHttpUrl, Http: client}
		}
	}
	deployed.AuditHistory = collaborators.History
	if deployed.AuditHistory == nil {
		deployed.AuditHistory = integrations.HttpAuditHistory{BaseUrl: settings.AdminInternalUrl, Token: settings.AdminInternalToken, Http: client}
	}
	deployed.UserSummaries = collaborators.Summaries
	if deployed.UserSummaries == nil {
		deployed.UserSummaries = integrations.HttpPlatformUserSummaries{BaseUrl: settings.IdentityInternalUrl, Token: settings.IdentityInternalToken, Http: client}
	}
	deployed.Audit = collaborators.Audit
	if deployed.Audit == nil && settings.AdminInternalUrl != "" {
		deployed.Audit = staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
	}
	if deployed.Audit == nil && settings.IsProduction() {
		deployed.Logger.Warn("ADMIN_INTERNAL_URL is not set: staff actions on ads are not audited")
	}
}

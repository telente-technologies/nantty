package loaders

import (
	"net/http"
	"time"

	"zudomart/modules/ads/src/configs"
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/integrations"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/platform/staffaudit"
)

func completeStaffAndMoneyCollaborators(deployed *container.Container, collaborators Collaborators, settings configs.AdsSettings) {
	client := &http.Client{Timeout: 5 * time.Second}
	deployed.TopUps = collaborators.TopUps
	if deployed.TopUps == nil {
		deployed.TopUps = integrations.UnavailableTopUpGateway{}
		if settings.MoneyHttpUrl != "" {
			deployed.TopUps = integrations.HttpMoneyTopUpGateway{BaseUrl: settings.MoneyHttpUrl, Token: settings.MoneyHttpToken, Http: client}
		}
	}
	completeMoneyAccountCollaborators(deployed, collaborators, settings, client)
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

func completeMoneyAccountCollaborators(deployed *container.Container, collaborators Collaborators, settings configs.AdsSettings, client *http.Client) {
	var money interface {
		interfaces.VerificationReader
		interfaces.EntitlementReader
		interfaces.EarningsFunding
		interfaces.StepUpConsumer
	} = integrations.UnconfiguredMoneyAccountGateway{}
	if settings.MoneyHttpUrl != "" {
		money = integrations.HttpMoneyAccountGateway{BaseUrl: settings.MoneyHttpUrl, Token: settings.MoneyHttpToken, Http: client}
	}
	deployed.Verification, deployed.Entitlements, deployed.EarningsFunding = collaborators.Verification, collaborators.Entitlements, collaborators.Earnings
	if deployed.Verification == nil {
		deployed.Verification = money
		if settings.MoneyHttpUrl == "" && settings.AllowInMemoryFunding && !settings.IsProduction() {
			deployed.Logger.Warn("no money service is configured: every user counts as payout-verified for ads")
			deployed.Verification = integrations.StaticVerificationReader{Level: 1}
		}
	}
	if deployed.Entitlements == nil {
		deployed.Entitlements = money
		if settings.MoneyHttpUrl == "" && !settings.IsProduction() {
			deployed.Entitlements = integrations.StaticEntitlementReader{}
		}
	}
	if deployed.EarningsFunding == nil {
		deployed.EarningsFunding = money
	}
	deployed.AdLoad = integrations.PremiumOnlyAdLoadReader{Entitlements: deployed.Entitlements}
	if reader, ok := deployed.Entitlements.(interfaces.AdLoadReader); ok {
		deployed.AdLoad = integrations.NewCachedAdLoadReader(reader, time.Minute, deployed.Now)
	}
	deployed.StepUps = collaborators.StepUps
	if deployed.StepUps == nil {
		deployed.StepUps = money
		if settings.MoneyHttpUrl == "" && settings.AllowInMemoryFunding && !settings.IsProduction() {
			deployed.StepUps = integrations.NewInMemoryStepUpConsumer()
		}
	}
}

package configs

import (
	"net/url"
	"strings"

	platformconfig "zudomart/platform/config"
)

type ModerationSettings struct {
	Environment          string
	DatabaseUrl          string
	DatabaseSchema       string
	DomainEventsTopicArn string
	JwksUrl              string
	TokenIssuer          string
	TokenAudience        string
	UsersInternalUrl     string
	UsersInternalToken   string
	IntakeToken          string
	AdminInternalToken   string
	ReportsPerHour       int
	AdvisoryQueueUrl     string
	AdvisoryQueueName    string
	ReportEventsQueue    string
	ContentScoresQueue   string
	TargetSources        map[string]InternalSource
}

type InternalSource struct {
	BaseUrl string
	Token   string
}

func (settings ModerationSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadModerationSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) ModerationSettings {
	settings := ModerationSettings{
		Environment:          reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:          reader.ReadRequiredString("MODERATION_DATABASE_URL"),
		DatabaseSchema:       reader.ReadStringOrDefault("MODERATION_DATABASE_SCHEMA", "moderation"),
		DomainEventsTopicArn: reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		JwksUrl:              reader.ReadRequiredString("AUTH_JWKS_URL"),
		TokenIssuer:          reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:        reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		UsersInternalUrl:     reader.ReadStringOrDefault("MODERATION_USERS_INTERNAL_URL", "http://localhost:8101"),
		UsersInternalToken:   reader.ReadStringOrDefault("USERS_INTERNAL_API_TOKEN", ""),
		IntakeToken:          reader.ReadStringOrDefault("MODERATION_INTERNAL_API_TOKEN", ""),
		AdminInternalToken:   reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		ReportsPerHour:       reader.ReadIntegerOrDefault("MODERATION_REPORTS_PER_HOUR", 5),
		AdvisoryQueueUrl:     reader.ReadStringOrDefault("INTELLIGENCE_TRUST_ADVISORY_QUEUE_URL", ""),
	}
	settings.AdvisoryQueueName = reader.ReadStringOrDefault("INTELLIGENCE_TRUST_ADVISORY_QUEUE", lastPathSegment(settings.AdvisoryQueueUrl))
	settings.ReportEventsQueue = reader.ReadStringOrDefault("MODERATION_REPORT_EVENTS_QUEUE", "trust-domain-events")
	settings.ContentScoresQueue = reader.ReadStringOrDefault("INTELLIGENCE_TRUST_CONTENT_SCORES_QUEUE", "intelligence-trust-content-scores")
	settings.TargetSources = map[string]InternalSource{}
	for name, prefix := range map[string]string{"social": "MODERATION_SOCIAL_INTERNAL", "commerce": "MODERATION_COMMERCE_INTERNAL", "live": "MODERATION_LIVE_INTERNAL"} {
		if baseUrl := reader.ReadStringOrDefault(prefix+"_URL", ""); baseUrl != "" {
			settings.TargetSources[name] = InternalSource{BaseUrl: baseUrl, Token: reader.ReadStringOrDefault(prefix+"_TOKEN", "")}
		}
	}
	reader.RequireMinimumLength("USERS_INTERNAL_API_TOKEN", settings.UsersInternalToken, 32)
	reader.RequireMinimumLength("ADMIN_INTERNAL_API_TOKEN", settings.AdminInternalToken, 32)
	reader.RequireMinimumLength("MODERATION_INTERNAL_API_TOKEN", settings.IntakeToken, 32)
	return settings
}

func lastPathSegment(rawUrl string) string {
	parsed, err := url.Parse(rawUrl)
	if err != nil {
		return ""
	}
	return parsed.Path[strings.LastIndex(parsed.Path, "/")+1:]
}

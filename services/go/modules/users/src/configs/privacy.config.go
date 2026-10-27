package configs

import (
	"time"

	platformconfig "nantty/platform/config"
)

type PrivacySettings struct {
	ExportBucket               string
	DocumentsBucket            string
	ExportObjectEndpoint       string
	ExportRegion               string
	ExportDownloadLinkTtl      time.Duration
	ExportArchiveTtl           time.Duration
	ExportWorkerPollInterval   time.Duration
	DeletionGraceDays          int
	DeletionWorkerPollInterval time.Duration
	InternalApiToken           string
	NotificationServiceToken   string
	MoneyInternalUrl           string
	MoneyInternalToken         string
	AnonymousConsentPerMinute  int
}

func ReadPrivacySettingsFromEnvironment(reader *platformconfig.EnvironmentReader) PrivacySettings {
	return PrivacySettings{
		ExportBucket:               reader.ReadStringOrDefault("USERS_EXPORT_BUCKET", "nantty-exports"),
		DocumentsBucket:            reader.ReadStringOrDefault("USERS_DOCUMENTS_BUCKET", "nantty-private-documents"),
		ExportObjectEndpoint:       reader.ReadStringOrDefault("USERS_EXPORT_S3_ENDPOINT", reader.ReadStringOrDefault("AWS_ENDPOINT_URL", "")),
		ExportRegion:               reader.ReadStringOrDefault("AWS_REGION", "eu-west-1"),
		ExportDownloadLinkTtl:      reader.ReadDurationOrDefault("USERS_EXPORT_DOWNLOAD_LINK_TTL", 15*time.Minute),
		ExportArchiveTtl:           reader.ReadDurationOrDefault("USERS_EXPORT_ARCHIVE_TTL", 72*time.Hour),
		ExportWorkerPollInterval:   reader.ReadDurationOrDefault("USERS_EXPORT_WORKER_POLL_INTERVAL", 10*time.Second),
		DeletionGraceDays:          reader.ReadIntegerOrDefault("USERS_DELETION_GRACE_DAYS", 30),
		DeletionWorkerPollInterval: reader.ReadDurationOrDefault("USERS_DELETION_WORKER_POLL_INTERVAL", time.Minute),
		InternalApiToken:           reader.ReadStringOrDefault("USERS_INTERNAL_API_TOKEN", ""),
		MoneyInternalUrl:           reader.ReadStringOrDefault("USERS_MONEY_INTERNAL_URL", ""),
		MoneyInternalToken:         reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		NotificationServiceToken:   reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		AnonymousConsentPerMinute:  reader.ReadIntegerOrDefault("USERS_ANONYMOUS_CONSENT_PER_MINUTE", 30),
	}
}

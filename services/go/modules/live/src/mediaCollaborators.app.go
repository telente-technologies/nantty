package src

import (
	"context"
	"database/sql"
	"log/slog"

	"zudomart/modules/live/src/configs"
	"zudomart/modules/live/src/integrations"
)

func completeMediaAndSocialCollaborators(ctx context.Context, collaborators *Collaborators, settings configs.LiveSettings, database *sql.DB, logger *slog.Logger) error {
	if collaborators.Ingress == nil {
		collaborators.Ingress = integrations.NewLiveKitIngressController(settings.LiveKitUrl, settings.LiveKitApiKey, settings.LiveKitApiSecret)
	}
	if collaborators.Relations == nil {
		collaborators.Relations = integrations.SchemaSocialRelations{Database: database, SocialSchema: "social", IdentitySchema: "users", NotificationsSchema: "notifications", TolerateUnreadableTables: !settings.IsProduction(), Logger: logger}
	}
	if collaborators.Recorder != nil && collaborators.RecordingStorage != nil {
		return nil
	}
	if settings.RecordingBucket == "" {
		logger.Warn("LIVE_RECORDING_S3_BUCKET is not set: live recording is unavailable")
		collaborators.Recorder, collaborators.RecordingStorage = integrations.UnconfiguredRecording{}, integrations.UnconfiguredRecording{}
		return nil
	}
	storage, err := integrations.NewS3RecordingStorage(ctx, settings.RecordingBucket, settings.RecordingRegion, settings.RecordingEndpoint)
	if err != nil {
		return err
	}
	collaborators.RecordingStorage = storage
	collaborators.Recorder = integrations.NewLiveKitRecordingController(settings.LiveKitUrl, settings.LiveKitApiKey, settings.LiveKitApiSecret, integrations.RecordingDestination{
		Bucket: settings.RecordingBucket, Region: settings.RecordingRegion, Endpoint: settings.RecordingEndpoint, AccessKey: settings.RecordingAccessKey, Secret: settings.RecordingSecret,
	})
	return nil
}

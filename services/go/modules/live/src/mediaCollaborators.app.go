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
	if err := completeSafetyCaptureCollaborators(ctx, collaborators, settings, logger); err != nil {
		return err
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

func completeSafetyCaptureCollaborators(ctx context.Context, collaborators *Collaborators, settings configs.LiveSettings, logger *slog.Logger) error {
	if collaborators.SafetyCapture != nil && collaborators.SafetyObjects != nil {
		return nil
	}
	safety := settings.Safety
	if !safety.SamplerEnabled || safety.FramesBucket == "" {
		if safety.SamplerEnabled {
			logger.Warn("LIVE_SAFETY_FRAMES_S3_BUCKET is not set: live frame sampling is off")
		}
		collaborators.SafetyCapture, collaborators.SafetyObjects = integrations.UnconfiguredSafetyCapture{}, integrations.UnconfiguredSafetyCapture{}
		return nil
	}
	lister, err := integrations.NewS3SafetyObjectLister(ctx, safety.FramesBucket, safety.FramesRegion, safety.FramesEndpoint)
	if err != nil {
		return err
	}
	collaborators.SafetyObjects = lister
	collaborators.SafetyCapture = integrations.NewLiveKitSafetyCapture(settings.LiveKitUrl, settings.LiveKitApiKey, settings.LiveKitApiSecret, integrations.SafetyCaptureDestination{
		Bucket: safety.FramesBucket, Region: safety.FramesRegion, Endpoint: safety.FramesEndpoint, AccessKey: safety.FramesAccessKey, Secret: safety.FramesSecret,
	})
	return nil
}

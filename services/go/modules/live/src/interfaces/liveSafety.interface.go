package interfaces

import (
	"context"
	"time"
)

type SafetyCaptureController interface {
	StartFrameCapture(ctx context.Context, room, filenamePrefix string, interval time.Duration, width int) (egressId string, err error)
	StartAudioCapture(ctx context.Context, room, filenamePrefix string, segment time.Duration) (egressId string, err error)
	StopCapture(ctx context.Context, egressId string) error
}

type StoredSafetyObject struct {
	Key          string
	LastModified time.Time
}

type SafetyObjectLister interface {
	ListObjectsAfter(ctx context.Context, prefix, startAfter string, limit int) ([]StoredSafetyObject, error)
}

type PublishPermissionController interface {
	SetParticipantCanPublish(ctx context.Context, room, identity string, canPublish bool) error
}

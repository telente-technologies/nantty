package services

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/liveingress"
	"zudomart/modules/live/src/generated/ent/liverecording"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/types"
)

func (service *LiveService) GetStreamHealth(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.StreamHealthView, error) {
	session, err := service.requireHost(ctx, actor, liveId)
	if err != nil {
		return types.StreamHealthView{}, err
	}
	view := types.StreamHealthView{
		LiveId: liveId.String(), State: string(session.State), Viewers: session.Viewers, PeakViewers: session.PeakViewers,
		StartedAt: formatOptionalTime(session.StartedAt), CheckedAt: formatTime(service.Now()),
	}
	row, err := service.Client.LiveIngress.Query().Where(liveingress.LiveID(liveId), liveingress.StateEQ(liveingress.StateActive)).
		Order(ent.Desc(liveingress.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return view, nil
	}
	if err != nil {
		return types.StreamHealthView{}, err
	}
	status, err := service.Ingress.DescribeIngress(ctx, row.LivekitIngressID)
	if err != nil {
		service.Logger.Warn("ingress status unavailable", slog.String("liveId", liveId.String()), slog.Any("error", err))
		status = interfaces.IngressStatus{Status: "unknown"}
	}
	view.Ingress = presentIngressHealth(string(row.Protocol), status)
	return view, nil
}

func presentIngressHealth(protocol string, status interfaces.IngressStatus) *types.IngressHealthView {
	health := &types.IngressHealthView{Protocol: protocol, Status: status.Status}
	positive := func(value int) *int {
		if value <= 0 {
			return nil
		}
		return &value
	}
	if status.Error != "" {
		message := truncateText(status.Error, 200)
		health.Error = &message
	}
	health.VideoBitrateKbps, health.AudioBitrateKbps = positive(status.VideoBitrateKbps), positive(status.AudioBitrateKbps)
	health.Width, health.Height = positive(status.Width), positive(status.Height)
	if status.Framerate > 0 {
		framerate := status.Framerate
		health.Framerate = &framerate
	}
	return health
}

func (service *LiveService) DeleteLiveRecording(ctx context.Context, actor types.Actor, liveId, recordingId uuid.UUID) error {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return err
	}
	row, err := service.Client.LiveRecording.Query().Where(liverecording.ID(recordingId), liverecording.LiveID(liveId)).Only(ctx)
	if ent.IsNotFound(err) {
		return liveerrors.RecordingNotFound
	}
	if err != nil {
		return err
	}
	if row.State == liverecording.StateRecording {
		return liveerrors.RecordingInProgress
	}
	if err := service.RecordingStorage.DeleteObject(ctx, row.ObjectKey); err != nil {
		service.Logger.Error("recording object could not be deleted", slog.String("recordingId", recordingId.String()), slog.Any("error", err))
		return liveerrors.RecordingNotReady
	}
	return service.Client.LiveRecording.DeleteOneID(recordingId).Exec(ctx)
}

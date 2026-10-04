package recordlivereport

import (
	"context"
	"strings"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetysignal"
	"zudomart/modules/moderation/src/modules/liveSafety/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if strings.TrimSpace(command.LiveId) == "" || command.SourceEventId == "" {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "liveId", Message: "is required"}})
	}
	sourceKey := "report:" + command.SourceEventId
	if seen, err := services.SignalAlreadyRecorded(ctx, handler.Container.Client, sourceKey); err != nil || seen {
		return Result{}, err
	}
	reason, known := services.NormalizeLiveReportReason(command.Reason)
	if !known {
		reason = "other"
	}
	priority := services.PriorityForLiveReportReason(reason)
	var result Result
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		result, err = handler.record(ctx, command, reason, priority, sourceKey)
		if !ent.IsConstraintError(err) {
			return result, err
		}
		if seen, lookupErr := services.SignalAlreadyRecorded(ctx, handler.Container.Client, sourceKey); lookupErr == nil && seen {
			return result, nil
		}
	}
	return result, err
}

func (handler Handler) record(ctx context.Context, command Command, reason, priority, sourceKey string) (Result, error) {
	settings := handler.Container.Settings.LiveSafety.WithDefaults()
	now := handler.Container.Now()
	result := Result{Priority: priority}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		incident, err := services.LockOrOpenIncidentInTransaction(ctx, tx, command.LiveId, services.ParseOptionalUuid(command.HostId), priority, now)
		if err != nil {
			return err
		}
		result.IncidentId = incident.ID.String()
		frameRef := services.NearestSampledFrameRef(ctx, tx, command.LiveId, command.FrameRef, now)
		signal := tx.LiveSafetySignal.Create().SetIncidentID(incident.ID).SetLiveID(command.LiveId).SetKind(livesafetysignal.KindReport).SetSourceKey(sourceKey).
			SetReason(reason).SetDetails(truncate(command.Details, 500)).SetFrameRef(truncate(frameRef, 512)).SetCreatedAt(now)
		if reporter := services.ParseOptionalUuid(command.ReporterId); reporter != nil {
			signal.SetReporterID(*reporter)
		}
		if command.OffsetSeconds != nil && *command.OffsetSeconds >= 0 {
			signal.SetOffsetSeconds(*command.OffsetSeconds)
		}
		if err := signal.Exec(ctx); err != nil {
			return err
		}
		if incident, err = tx.LiveSafetyIncident.UpdateOne(incident).AddReportCount(1).SetLastReportedAt(now).SetUpdatedAt(now).Save(ctx); err != nil {
			return err
		}
		recent, err := services.RecentReportTimesInTransaction(ctx, tx, command.LiveId, now.Add(-settings.ReportSurgeWindow))
		if err != nil {
			return err
		}
		boostReason := "user_report"
		if services.IsReportSurge(settings, recent, now) {
			result.Surge, result.Priority, boostReason = true, "urgent", "report_surge"
			if incident, err = services.LockOrOpenIncidentInTransaction(ctx, tx, command.LiveId, nil, "urgent", now); err != nil {
				return err
			}
		}
		_, err = services.BoostSamplingInTransaction(ctx, tx, incident, settings.SamplingBoost, boostReason, now)
		return err
	})
	return result, err
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

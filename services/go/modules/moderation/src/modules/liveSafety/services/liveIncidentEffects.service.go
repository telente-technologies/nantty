package services

import (
	"context"
	"time"

	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/livesafetyincident"
	safetyevents "nantty/modules/moderation/src/modules/liveSafety/events"
)

func stamp(moment time.Time) string { return moment.UTC().Format(time.RFC3339) }

func ApplyHoldInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, category, source string, confidence float64, now time.Time) (*ent.LiveSafetyIncident, error) {
	if incident.HoldActive {
		return incident, nil
	}
	reason := HostFacingReasonForCategory(category)
	updated, err := tx.LiveSafetyIncident.UpdateOne(incident).SetHoldActive(true).SetHoldCategory(category).SetHoldReason(reason).SetHoldSource(source).SetHoldStartedAt(now).
		SetPriority(livesafetyincident.PriorityUrgent).SetSLADueAt(minTime(incident.SLADueAt, now.Add(SlaForPriority("urgent")))).SetUpdatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	return updated, events.EnqueueOutboxEventInTransaction(ctx, tx, safetyevents.LiveSafetyHoldType, incident.LiveID, now, safetyevents.LiveSafetyHoldData{
		LiveId: incident.LiveID, HostId: HostIdString(incident), IncidentId: incident.ID.String(), Category: category, Reason: reason, Source: source, Confidence: confidence, HeldAt: stamp(now), Appealable: true,
	})
}

func ReleaseHoldInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, now time.Time) (*ent.LiveSafetyIncident, error) {
	if !incident.HoldActive {
		return incident, nil
	}
	updated, err := tx.LiveSafetyIncident.UpdateOne(incident).SetHoldActive(false).SetUpdatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	return updated, events.EnqueueOutboxEventInTransaction(ctx, tx, safetyevents.LiveSafetyReleasedType, incident.LiveID, now, safetyevents.LiveSafetyReleasedData{
		LiveId: incident.LiveID, HostId: HostIdString(incident), IncidentId: incident.ID.String(), ReleasedAt: stamp(now),
	})
}

func WarnHostInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, category string, cooldown time.Duration, now time.Time) (*ent.LiveSafetyIncident, error) {
	if incident.HoldActive || !ShouldWarnHostAgain(incident.LastWarnedAt, now, cooldown) {
		return incident, nil
	}
	updated, err := tx.LiveSafetyIncident.UpdateOne(incident).AddWarningCount(1).SetLastWarnedAt(now).SetUpdatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	return updated, events.EnqueueOutboxEventInTransaction(ctx, tx, safetyevents.LiveSafetyWarningType, incident.LiveID, now, safetyevents.LiveSafetyWarningData{
		LiveId: incident.LiveID, HostId: HostIdString(incident), IncidentId: incident.ID.String(), Category: category, Message: HostWarningMessageForCategory(category), WarnedAt: stamp(now),
	})
}

func BoostSamplingInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, boost time.Duration, reason string, now time.Time) (*ent.LiveSafetyIncident, error) {
	until := now.Add(boost)
	if incident.SamplingBoostUntil != nil && incident.SamplingBoostUntil.After(until.Add(-boost/2)) {
		return incident, nil
	}
	updated, err := tx.LiveSafetyIncident.UpdateOne(incident).SetSamplingBoostUntil(until).SetUpdatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	return updated, events.EnqueueOutboxEventInTransaction(ctx, tx, safetyevents.LiveSamplingBoostType, incident.LiveID, now, safetyevents.LiveSamplingBoostData{
		LiveId: incident.LiveID, IncidentId: incident.ID.String(), BoostUntil: stamp(until), Reason: reason,
	})
}

func PublishModeratorEndInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, reason string, suspended bool, now time.Time) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, safetyevents.LiveModeratorEndedType, incident.LiveID, now, safetyevents.LiveModeratorEndedData{
		LiveId: incident.LiveID, HostId: HostIdString(incident), IncidentId: incident.ID.String(), Reason: reason, Suspended: suspended, EndedAt: stamp(now),
	})
}

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}

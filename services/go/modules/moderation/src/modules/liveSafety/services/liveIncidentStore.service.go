package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/livesafetyincident"
	"nantty/modules/moderation/src/generated/ent/livesafetysignal"
)

func FindOpenIncident(ctx context.Context, client *ent.Client, liveId string) (*ent.LiveSafetyIncident, error) {
	incident, err := client.LiveSafetyIncident.Query().Where(livesafetyincident.LiveID(liveId), livesafetyincident.StatusEQ(livesafetyincident.StatusOpen)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return incident, err
}

func LockOrOpenIncidentInTransaction(ctx context.Context, tx *ent.Tx, liveId string, hostId *uuid.UUID, priority string, now time.Time) (*ent.LiveSafetyIncident, error) {
	incident, err := tx.LiveSafetyIncident.Query().Where(livesafetyincident.LiveID(liveId), livesafetyincident.StatusEQ(livesafetyincident.StatusOpen)).ForUpdate().Only(ctx)
	if err == nil {
		return raiseIncidentPriorityInTransaction(ctx, tx, incident, hostId, priority, now)
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	create := tx.LiveSafetyIncident.Create().SetLiveID(liveId).SetPriority(livesafetyincident.Priority(priority)).SetSLADueAt(now.Add(SlaForPriority(priority))).SetCreatedAt(now).SetUpdatedAt(now)
	if hostId != nil {
		create.SetHostID(*hostId)
	}
	return create.Save(ctx)
}

func raiseIncidentPriorityInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, hostId *uuid.UUID, priority string, now time.Time) (*ent.LiveSafetyIncident, error) {
	wanted := HigherPriority(string(incident.Priority), priority)
	needsHost := incident.HostID == nil && hostId != nil
	if wanted == string(incident.Priority) && !needsHost {
		return incident, nil
	}
	update := tx.LiveSafetyIncident.UpdateOne(incident).SetPriority(livesafetyincident.Priority(wanted)).SetUpdatedAt(now)
	if dueAt := now.Add(SlaForPriority(wanted)); dueAt.Before(incident.SLADueAt) {
		update.SetSLADueAt(dueAt)
	}
	if needsHost {
		update.SetHostID(*hostId)
	}
	return update.Save(ctx)
}

func SignalAlreadyRecorded(ctx context.Context, client *ent.Client, sourceKey string) (bool, error) {
	return client.LiveSafetySignal.Query().Where(livesafetysignal.SourceKey(sourceKey)).Exist(ctx)
}

func RecentReportTimesInTransaction(ctx context.Context, tx *ent.Tx, liveId string, since time.Time) ([]time.Time, error) {
	rows, err := tx.LiveSafetySignal.Query().Where(livesafetysignal.LiveID(liveId), livesafetysignal.KindEQ(livesafetysignal.KindReport), livesafetysignal.CreatedAtGTE(since)).
		Select(livesafetysignal.FieldCreatedAt).All(ctx)
	if err != nil {
		return nil, err
	}
	times := make([]time.Time, 0, len(rows))
	for _, row := range rows {
		times = append(times, row.CreatedAt)
	}
	return times, nil
}

func HostIdString(incident *ent.LiveSafetyIncident) string {
	if incident.HostID == nil {
		return ""
	}
	return incident.HostID.String()
}

func ParseOptionalUuid(raw string) *uuid.UUID {
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return nil
	}
	return &parsed
}

const reportFrameMatchWindow = time.Minute

func NearestSampledFrameRef(ctx context.Context, tx *ent.Tx, liveId, clientRef string, now time.Time) string {
	if clientRef != "" && !strings.HasPrefix(clientRef, "live:") {
		return clientRef
	}
	latest, err := tx.LiveSafetySignal.Query().Where(livesafetysignal.LiveID(liveId), livesafetysignal.KindEQ(livesafetysignal.KindFrame), livesafetysignal.HashMatch(false),
		livesafetysignal.CreatedAtGTE(now.Add(-reportFrameMatchWindow)), livesafetysignal.FrameRefNEQ("")).Order(ent.Desc(livesafetysignal.FieldCreatedAt)).First(ctx)
	if err != nil {
		return clientRef
	}
	return latest.FrameRef
}

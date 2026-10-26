package ingestlivesafetyscore

import (
	"context"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/legalreport"
)

func recordLegalReportInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, command Command, evidenceKey string) error {
	exists, err := tx.LegalReport.Query().Where(legalreport.IncidentID(incident.ID)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	create := tx.LegalReport.Create().SetIncidentID(incident.ID).SetLiveID(incident.LiveID).SetCategory("child_safety").
		SetProvider(truncate(command.HashMatchProvider, 60)).SetMatchReference(truncate(command.HashMatchReference, 200)).SetEvidenceKey(evidenceKey)
	if incident.HostID != nil {
		create.SetHostID(*incident.HostID)
	}
	return create.Exec(ctx)
}

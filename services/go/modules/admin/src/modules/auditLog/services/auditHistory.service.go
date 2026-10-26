package services

import (
	"context"
	"encoding/json"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/auditevent"
	"nantty/modules/admin/src/modules/auditLog/models"
)

type AuditHistoryService struct {
	Container *container.Container
}

func (service AuditHistoryService) ListAuditHistoryForSubject(ctx context.Context, subjectType, subjectId string, limit int) ([]json.RawMessage, error) {
	rows, err := service.Container.Client.AuditEvent.Query().Where(auditevent.SubjectType(subjectType), auditevent.SubjectID(subjectId)).Order(ent.Desc(auditevent.FieldID)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	history := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		encoded, err := json.Marshal(models.ConvertAuditEventToView(row))
		if err != nil {
			return nil, err
		}
		history = append(history, encoded)
	}
	return history, nil
}

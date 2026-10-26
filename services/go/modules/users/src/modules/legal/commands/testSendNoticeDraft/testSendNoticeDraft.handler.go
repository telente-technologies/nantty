package testsendnoticedraft

import (
	"context"
	"encoding/json"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	legalevents "nantty/modules/users/src/modules/legal/events"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.NoticeDraftView, error) {
	var view services.NoticeDraftView
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, command.VersionId, false)
		if err != nil {
			return err
		}
		draft, err := services.EnsureNoticeDraft(ctx, tx.Client(), version)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		sends := []json.RawMessage{}
		_ = json.Unmarshal(draft.TestSends, &sends)
		entry, _ := json.Marshal(map[string]string{"sentAt": now.UTC().Format(time.RFC3339), "sentToStaffId": command.Actor.Id, "sentByName": command.Actor.Name})
		encoded, _ := json.Marshal(append(sends, entry))
		updated, err := draft.Update().SetTestSends(encoded).Save(ctx)
		if err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, legalevents.LegalNoticeTestRequestedType, version.ID.String(), now, legalevents.TestRequestedData{VersionId: version.ID.String(), StaffId: command.Actor.Id, Email: services.EmailDraftOf(draft, version)}); err != nil {
			return err
		}
		view = services.ConvertDraftToView(updated, version)
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "legal_notice_draft.test_sent", SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: "test email to own address",
		})
	})
	return view, err
}

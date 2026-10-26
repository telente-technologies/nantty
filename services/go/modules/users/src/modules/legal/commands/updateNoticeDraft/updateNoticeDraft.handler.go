package updatenoticedraft

import (
	"context"
	"strings"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.NoticeDraftView, error) {
	subject := strings.TrimSpace(command.Subject)
	if subject == "" || len(subject) > 200 || len(command.SummaryText) > 4000 || len(command.WhatChanged) > 30 || len(command.ReacceptNote) > 500 {
		return services.NoticeDraftView{}, usersErrors.ValidationFailedFor("subject", "needs a subject of up to 200 characters, a summary of up to 4000 and at most 30 changes")
	}
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
		updated, err := draft.Update().SetSubject(subject).SetSummaryText(command.SummaryText).SetWhatChanged(command.WhatChanged).SetReacceptNote(command.ReacceptNote).SetUpdatedByName(command.Actor.Name).Save(ctx)
		if err != nil {
			return err
		}
		view = services.ConvertDraftToView(updated, version)
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "legal_notice_draft.updated", SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: "notice draft edited",
			Before: map[string]any{"subject": draft.Subject}, After: map[string]any{"subject": subject},
		})
	})
	return view, err
}

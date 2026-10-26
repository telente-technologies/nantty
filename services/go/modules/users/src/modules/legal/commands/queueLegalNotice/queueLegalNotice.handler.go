package queuelegalnotice

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalnotice"
	"nantty/modules/users/src/generated/ent/legalversion"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	legalevents "nantty/modules/users/src/modules/legal/events"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.NoticeProgressView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.NoticeProgressView{}, err
	}
	var created *ent.LegalNotice
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, command.VersionId, true)
		if err != nil {
			return err
		}
		if version.Status != legalversion.StatusPublished {
			return usersErrors.Conflict("NOT_PUBLISHED", "Only a published version can be sent.")
		}
		if running, err := tx.LegalNotice.Query().Where(legalnotice.VersionID(version.ID), legalnotice.StatusIn(legalnotice.StatusQueued, legalnotice.StatusSending)).Exist(ctx); err != nil || running {
			return usersErrors.OrConflict(err, "NOTICE_IN_PROGRESS", "A notice for this version is already being sent.")
		}
		draft, err := services.EnsureNoticeDraft(ctx, tx.Client(), version)
		if err != nil {
			return err
		}
		recipients, err := services.CountNoticeRecipients(ctx, tx.Client())
		if err != nil {
			return err
		}
		if created, err = tx.LegalNotice.Create().SetVersionID(version.ID).SetDocumentKey(version.DocumentKey).SetVersionNumber(version.VersionNumber).SetSubject(draft.Subject).
			SetRecipientCount(recipients).SetQueuedBy(command.Actor.Id).SetQueuedByName(command.Actor.Name).Save(ctx); err != nil {
			return err
		}
		email := services.EmailDraftOf(draft, version)
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, legalevents.LegalNoticeQueuedType, created.ID.String(), handler.Container.Now(), legalevents.PolicyPublishedData{
			PolicyVersionId: version.ID.String(), DocumentKey: version.DocumentKey, VersionNumber: version.VersionNumber, IsMaterialChange: version.IsMaterialChange, EffectiveAt: email.EffectiveAt, Recipients: "all_active_users", Email: &email,
			NoticeId: func() *string { id := created.ID.String(); return &id }(),
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "legal_notice.queued", SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: reason, After: map[string]any{"noticeId": created.ID, "recipients": recipients},
		})
	})
	if err != nil {
		return services.NoticeProgressView{}, err
	}
	return services.ConvertNoticeToView(created), nil
}

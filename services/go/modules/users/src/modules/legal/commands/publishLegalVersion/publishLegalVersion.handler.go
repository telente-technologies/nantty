package publishlegalversion

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalversion"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	legalevents "nantty/modules/users/src/modules/legal/events"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	var published *ent.LegalVersion
	var noticeId *string
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, command.VersionId, true)
		if err != nil {
			return err
		}
		if err := handler.assertPublishable(version, command); err != nil {
			return err
		}
		now := handler.Container.Now()
		if version.IsMaterialChange && version.EffectiveAtIsDefault && version.EffectiveAt.Before(now.Add(services.MaterialNoticePeriod)) {
			if version, err = version.Update().SetEffectiveAt(now.Add(services.MaterialNoticePeriod)).Save(ctx); err != nil {
				return err
			}
		}
		if _, err := tx.LegalVersion.Update().Where(legalversion.DocumentKey(version.DocumentKey), legalversion.StatusEQ(legalversion.StatusPublished)).SetStatus(legalversion.StatusSuperseded).Save(ctx); err != nil {
			return err
		}
		update := version.Update().SetStatus(legalversion.StatusPublished).SetPublishedBy(command.Actor.Id).SetPublishedByName(command.Actor.Name).SetPublishedAt(now)
		draft, err := services.EnsureNoticeDraft(ctx, tx.Client(), version)
		if err != nil {
			return err
		}
		var email *legalevents.EmailDraft
		if services.NoticeRequiredFor(version.DocumentKey, version.IsMaterialChange) {
			notice, err := handler.queueNotice(ctx, tx, version, draft, command)
			if err != nil {
				return err
			}
			update.SetNoticeID(notice.ID)
			identifier := notice.ID.String()
			noticeId = &identifier
			draftEmail := services.EmailDraftOf(draft, version)
			email = &draftEmail
		}
		if published, err = update.Save(ctx); err != nil {
			return err
		}
		definition, _ := services.DefinitionOf(version.DocumentKey)
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, legalevents.PolicyPublishedType, version.ID.String(), now, legalevents.PolicyPublishedData{
			PolicyVersionId: version.ID.String(), DocumentKey: version.DocumentKey, DocumentTitle: definition.Title, VersionNumber: version.VersionNumber, IsMaterialChange: version.IsMaterialChange,
			EffectiveAt: version.EffectiveAt.UTC().Format("2006-01-02T15:04:05Z07:00"), NoticeId: noticeId, Recipients: "all_active_users", Email: email,
		}); err != nil {
			return err
		}
		changed := draft.WhatChanged
		if changed == nil {
			changed = []string{}
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, legalevents.PolicyVersionPublishedType, version.ID.String(), now, legalevents.PolicyVersionPublishedNotice{
			Kind: services.EventKindFor(version.DocumentKey), Version: "v" + services.VersionNumberText(version.VersionNumber), EffectiveAt: version.EffectiveAt.UTC().Format("2006-01-02T15:04:05Z07:00"), PublishedBy: command.Actor.Id,
			VersionId: version.ID.String(), DocumentKey: version.DocumentKey, DocumentTitle: definition.Title, ChangeSummary: version.ChangeSummary, WhatChanged: changed, IsMaterialChange: version.IsMaterialChange,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "legal_version.published", SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: reason,
			Before: map[string]any{"status": version.Status}, After: map[string]any{"status": "published", "versionNumber": version.VersionNumber, "noticeQueued": noticeId != nil, "shortNoticeAcknowledged": command.AcknowledgeShortNotice},
		})
	})
	if err != nil {
		return Result{}, err
	}
	return Result{Version: services.ConvertVersionToView(published), NoticeId: noticeId}, nil
}

func (handler Handler) assertPublishable(version *ent.LegalVersion, command Command) error {
	if version.Status != legalversion.StatusInReview {
		return usersErrors.Conflict("NOT_IN_REVIEW", "Only a version in review can be published.")
	}
	if version.CreatedBy == command.Actor.Id || version.SubmittedBy == command.Actor.Id {
		return usersErrors.Conflict("SAME_ADMIN", "A different admin must publish this version.")
	}
	if version.IsMaterialChange && !version.EffectiveAtIsDefault && version.EffectiveAt.Before(handler.Container.Now().Add(services.MaterialNoticePeriod)) && !command.AcknowledgeShortNotice {
		return usersErrors.Conflict("SHORT_NOTICE", "A material change needs 30 days notice unless legal cleared a shorter period.")
	}
	return nil
}

func (handler Handler) queueNotice(ctx context.Context, tx *ent.Tx, version *ent.LegalVersion, draft *ent.LegalNoticeDraft, command Command) (*ent.LegalNotice, error) {
	recipients, err := services.CountNoticeRecipients(ctx, tx.Client())
	if err != nil {
		return nil, err
	}
	return tx.LegalNotice.Create().SetVersionID(version.ID).SetDocumentKey(version.DocumentKey).SetVersionNumber(version.VersionNumber).SetSubject(draft.Subject).
		SetRecipientCount(recipients).SetQueuedBy(command.Actor.Id).SetQueuedByName(command.Actor.Name).Save(ctx)
}

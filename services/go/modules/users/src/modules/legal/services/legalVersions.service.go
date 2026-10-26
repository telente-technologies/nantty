package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalnoticedraft"
	"nantty/modules/users/src/generated/ent/legalversion"
	"nantty/modules/users/src/generated/ent/profile"
	legalevents "nantty/modules/users/src/modules/legal/events"
)

const (
	MaterialNoticePeriod = 30 * 24 * time.Hour
	maximumBodyBytes     = 400_000
)

func LoadVersionInTransaction(ctx context.Context, tx *ent.Tx, rawId string, lock bool) (*ent.LegalVersion, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return nil, usersErrors.NotFound("That version was not found.")
	}
	query := tx.LegalVersion.Query().Where(legalversion.ID(identifier))
	if lock {
		query = query.ForUpdate()
	}
	row, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil, usersErrors.NotFound("That version was not found.")
	}
	return row, err
}

func ValidateVersionBody(body, summary string) error {
	if strings.TrimSpace(body) == "" || len(body) > maximumBodyBytes {
		return usersErrors.ValidationFailedFor("bodyMarkdown", "is required and must be under 400 KB")
	}
	if len(summary) > 500 {
		return usersErrors.ValidationFailedFor("changeSummary", "must be at most 500 characters")
	}
	return nil
}

func ResolveEffectiveAt(raw string, material bool, now time.Time) (time.Time, error) {
	if raw == "" {
		if material {
			return now.Add(MaterialNoticePeriod), nil
		}
		return now, nil
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, usersErrors.ValidationFailedFor("effectiveAt", "must be an RFC 3339 timestamp")
	}
	return parsed, nil
}

func PreviousPublishedBody(ctx context.Context, client *ent.Client, documentKey string, excluding uuid.UUID) string {
	previous, err := client.LegalVersion.Query().Where(legalversion.DocumentKey(documentKey), legalversion.StatusIn(legalversion.StatusPublished, legalversion.StatusSuperseded), legalversion.IDNEQ(excluding)).Order(ent.Desc(legalversion.FieldVersionNumber)).First(ctx)
	if err != nil {
		return ""
	}
	return previous.BodyMarkdown
}

func EnsureNoticeDraft(ctx context.Context, client *ent.Client, version *ent.LegalVersion) (*ent.LegalNoticeDraft, error) {
	existing, err := client.LegalNoticeDraft.Query().Where(legalnoticedraft.VersionID(version.ID)).Only(ctx)
	if err == nil || !ent.IsNotFound(err) {
		return existing, err
	}
	definition, _ := DefinitionOf(version.DocumentKey)
	note := ""
	if version.IsMaterialChange {
		note = "You will be asked to accept the updated " + definition.Title + " before " + version.EffectiveAt.UTC().Format("2 January 2006") + "."
	}
	created, err := client.LegalNoticeDraft.Create().SetVersionID(version.ID).SetSubject("Updates to our " + definition.Title).SetSummaryText(version.ChangeSummary).
		SetWhatChanged(GenerateWhatChanged(PreviousPublishedBody(ctx, client, version.DocumentKey, version.ID), version.BodyMarkdown)).SetReacceptNote(note).Save(ctx)
	if ent.IsConstraintError(err) {
		return client.LegalNoticeDraft.Query().Where(legalnoticedraft.VersionID(version.ID)).Only(ctx)
	}
	return created, err
}

func ConvertDraftToView(draft *ent.LegalNoticeDraft, version *ent.LegalVersion) NoticeDraftView {
	definition, _ := DefinitionOf(version.DocumentKey)
	sends := []json.RawMessage{}
	_ = json.Unmarshal(draft.TestSends, &sends)
	changed := draft.WhatChanged
	if changed == nil {
		changed = []string{}
	}
	return NoticeDraftView{
		VersionId: version.ID.String(), DocumentTitle: definition.Title, Subject: draft.Subject, SummaryText: draft.SummaryText, WhatChanged: changed, EffectiveAt: version.EffectiveAt.UTC().Format(time.RFC3339),
		ReacceptNote: draft.ReacceptNote, DocumentUrl: definition.PublicPath, UpdatedByName: draft.UpdatedByName, UpdatedAt: draft.UpdatedAt.UTC().Format(time.RFC3339), TestSends: sends,
	}
}

func EmailDraftOf(draft *ent.LegalNoticeDraft, version *ent.LegalVersion) legalevents.EmailDraft {
	definition, _ := DefinitionOf(version.DocumentKey)
	return legalevents.EmailDraft{Subject: draft.Subject, SummaryText: draft.SummaryText, WhatChanged: draft.WhatChanged, ReacceptNote: draft.ReacceptNote, DocumentUrl: definition.PublicPath, EffectiveAt: version.EffectiveAt.UTC().Format(time.RFC3339)}
}

func CountNoticeRecipients(ctx context.Context, client *ent.Client) (int, error) {
	return client.Profile.Query().Where(profile.KindEQ(profile.KindPersonal), profile.StatusEQ(profile.StatusActive)).Count(ctx)
}

func NoticeRequiredFor(documentKey string, material bool) bool {
	return documentKey == "terms" || documentKey == "privacy" || material
}

package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/strike"
	strikeevents "nantty/modules/moderation/src/modules/strikes/events"
	"nantty/platform/httpserver"
)

type IssueParams struct {
	AccountId     uuid.UUID
	Kind          string
	Policy        string
	Reason        string
	Source        string
	IssuedById    string
	IssuedByName  string
	ReferenceType string
	ReferenceId   string
	ExpiresInDays int
}

type Counts struct {
	ActiveStrikes  int
	ActiveWarnings int
}

type Recorder struct {
	Now func() time.Time
}

type StrikeChangeObserver func(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time, reason string) error

var strikeChangeObserver StrikeChangeObserver

func ObserveStrikeChangesInTransaction(observer StrikeChangeObserver) {
	strikeChangeObserver = observer
}

func notifyStrikeChangeInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time, reason string) error {
	if strikeChangeObserver == nil {
		return nil
	}
	return strikeChangeObserver(ctx, tx, accountId, now, reason)
}

func issuedChangeReason(params IssueParams) string {
	if params.Kind == "strike" && params.Source == "copyright" {
		return "copyright_strike_issued"
	}
	return params.Kind + "_issued"
}

func revokedChangeReason(reason string) string {
	if strings.HasPrefix(reason, "Appeal overturned") {
		return "appeal_overturned"
	}
	return "strike_revoked"
}

func ActiveCounts(ctx context.Context, client *ent.Client, now time.Time, accountIds []uuid.UUID) (map[uuid.UUID]Counts, error) {
	rows, err := client.Strike.Query().Where(strike.AccountIDIn(accountIds...), strike.RevokedAtIsNil(), strike.Or(strike.ExpiresAtIsNil(), strike.ExpiresAtGT(now))).All(ctx)
	if err != nil {
		return nil, err
	}
	counts := map[uuid.UUID]Counts{}
	for _, row := range rows {
		entry := counts[row.AccountID]
		if row.Kind == strike.KindWarning {
			entry.ActiveWarnings++
		} else {
			entry.ActiveStrikes++
		}
		counts[row.AccountID] = entry
	}
	return counts, nil
}

func (recorder Recorder) Issue(ctx context.Context, tx *ent.Tx, params IssueParams) (*ent.Strike, bool, error) {
	now := recorder.Now()
	key := ReferenceKey(params.ReferenceType, params.ReferenceId, params.Kind)
	if key != nil {
		existing, err := tx.Strike.Query().Where(strike.AccountID(params.AccountId), strike.ReferenceKey(*key)).Only(ctx)
		if err == nil {
			return existing, false, nil
		}
		if !ent.IsNotFound(err) {
			return nil, false, err
		}
	}
	expires := ExpiryFor(params.Kind, now, params.ExpiresInDays)
	create := tx.Strike.Create().SetAccountID(params.AccountId).SetKind(strike.Kind(params.Kind)).SetPolicy(params.Policy).SetReason(params.Reason).SetSource(strike.Source(params.Source)).
		SetIssuedByID(params.IssuedById).SetReferenceType(params.ReferenceType).SetReferenceID(params.ReferenceId).SetExpiresAt(expires).SetCreatedAt(now)
	if params.IssuedByName != "" {
		create.SetIssuedByName(params.IssuedByName)
	}
	if key != nil {
		create.SetReferenceKey(*key)
	}
	created, err := create.Save(ctx)
	if err != nil {
		return nil, false, err
	}
	counts, err := ActiveCounts(ctx, tx.Client(), now, []uuid.UUID{params.AccountId})
	if err != nil {
		return nil, false, err
	}
	expiry := expires.UTC().Format(time.RFC3339)
	active := counts[params.AccountId].ActiveStrikes
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeIssuedType, created.ID.String(), now, strikeevents.StrikeIssuedData{
		StrikeId: created.ID.String(), AccountId: params.AccountId.String(), Kind: params.Kind, Policy: params.Policy, Source: params.Source, ExpiresAt: &expiry, ActiveStrikeCount: active, IsRepeatInfringer: IsRepeatInfringer(active),
	}); err != nil {
		return nil, false, err
	}
	return created, true, notifyStrikeChangeInTransaction(ctx, tx, params.AccountId, now, issuedChangeReason(params))
}

func (recorder Recorder) Revoke(ctx context.Context, tx *ent.Tx, strikeId uuid.UUID, reason string) (*ent.Strike, error) {
	now := recorder.Now()
	row, err := tx.Strike.Get(ctx, strikeId)
	if ent.IsNotFound(err) {
		return nil, httpserver.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if row.RevokedAt != nil {
		return row, nil
	}
	row, err = tx.Strike.UpdateOne(row).SetRevokedAt(now).SetRevokedReason(reason).Save(ctx)
	if err != nil {
		return nil, err
	}
	counts, err := ActiveCounts(ctx, tx.Client(), now, []uuid.UUID{row.AccountID})
	if err != nil {
		return nil, err
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeRevokedType, row.ID.String(), now, strikeevents.StrikeRevokedData{
		StrikeId: row.ID.String(), AccountId: row.AccountID.String(), Reason: reason, ActiveStrikeCount: counts[row.AccountID].ActiveStrikes,
	}); err != nil {
		return nil, err
	}
	return row, notifyStrikeChangeInTransaction(ctx, tx, row.AccountID, now, revokedChangeReason(reason))
}

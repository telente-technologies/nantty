package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	strikeevents "zudomart/modules/moderation/src/modules/strikes/events"
	"zudomart/platform/httpserver"
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
	return created, true, events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeIssuedType, created.ID.String(), now, strikeevents.StrikeIssuedData{
		StrikeId: created.ID.String(), AccountId: params.AccountId.String(), Kind: params.Kind, Policy: params.Policy, Source: params.Source, ExpiresAt: &expiry, ActiveStrikeCount: active, IsRepeatInfringer: IsRepeatInfringer(active),
	})
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
	return row, events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeRevokedType, row.ID.String(), now, strikeevents.StrikeRevokedData{
		StrikeId: row.ID.String(), AccountId: row.AccountID.String(), Reason: reason, ActiveStrikeCount: counts[row.AccountID].ActiveStrikes,
	})
}

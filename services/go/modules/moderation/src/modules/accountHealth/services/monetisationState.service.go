package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/accountmonetisationstate"
)

const insertMissingMonetisationStateSql = `INSERT INTO account_monetisation_states (id, last_can_monetise, override_reason, override_actor_id, override_actor_name, override_active_strike_count, updated_at)
VALUES ($1, true, '', '', '', 0, $2) ON CONFLICT (id) DO NOTHING`

type MonetisationOverrideView struct {
	Mode                        string `json:"mode"`
	Reason                      string `json:"reason"`
	ActorId                     string `json:"actorId"`
	ActorName                   string `json:"actorName"`
	ActiveStrikeCountAtOverride int    `json:"activeStrikeCountAtOverride"`
	SetAt                       string `json:"setAt"`
}

func LockMonetisationStateInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time) (*ent.AccountMonetisationState, error) {
	if _, err := tx.ExecContext(ctx, insertMissingMonetisationStateSql, accountId, now); err != nil {
		return nil, err
	}
	return tx.AccountMonetisationState.Query().Where(accountmonetisationstate.ID(accountId)).ForUpdate().Only(ctx)
}

func OverrideFromState(state *ent.AccountMonetisationState) *MonetisationOverride {
	if state == nil || state.OverrideMode == nil {
		return nil
	}
	override := &MonetisationOverride{
		Mode: string(*state.OverrideMode), ActiveStrikeCountAtOverride: state.OverrideActiveStrikeCount, Reason: state.OverrideReason, ActorId: state.OverrideActorID, ActorName: state.OverrideActorName,
	}
	if state.OverrideSetAt != nil {
		override.SetAt = *state.OverrideSetAt
	}
	return override
}

func ReadMonetisationOverride(ctx context.Context, client *ent.Client, accountId uuid.UUID) (*MonetisationOverride, error) {
	state, err := client.AccountMonetisationState.Get(ctx, accountId)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return OverrideFromState(state), nil
}

func SetMonetisationOverrideInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, override MonetisationOverride) error {
	return tx.AccountMonetisationState.UpdateOneID(accountId).SetOverrideMode(accountmonetisationstate.OverrideMode(override.Mode)).SetOverrideReason(override.Reason).SetOverrideActorID(override.ActorId).
		SetOverrideActorName(override.ActorName).SetOverrideActiveStrikeCount(override.ActiveStrikeCountAtOverride).SetOverrideSetAt(override.SetAt).SetUpdatedAt(override.SetAt).Exec(ctx)
}

func ClearMonetisationOverrideInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time) error {
	return tx.AccountMonetisationState.UpdateOneID(accountId).ClearOverrideMode().SetOverrideReason("").SetOverrideActorID("").SetOverrideActorName("").SetOverrideActiveStrikeCount(0).ClearOverrideSetAt().SetUpdatedAt(now).Exec(ctx)
}

func DescribeMonetisationOverride(override *MonetisationOverride) *MonetisationOverrideView {
	if override == nil {
		return nil
	}
	return &MonetisationOverrideView{
		Mode: map[string]string{OverrideModeAllow: "ALLOW", OverrideModePause: "PAUSE"}[override.Mode], Reason: override.Reason, ActorId: override.ActorId, ActorName: override.ActorName,
		ActiveStrikeCountAtOverride: override.ActiveStrikeCountAtOverride, SetAt: override.SetAt.UTC().Format(time.RFC3339),
	}
}

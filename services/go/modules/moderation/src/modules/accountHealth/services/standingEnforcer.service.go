package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/integrations"
	copyrightservices "zudomart/modules/moderation/src/modules/copyrightClaims/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
)

const AccountHealthChangedType = "accountHealth.changed"

const ReasonOverrideCancelledByNewStrike = "monetisation_override_cancelled_by_new_strike"

type AccountHealthChangedData struct {
	AccountId                string   `json:"accountId"`
	Status                   string   `json:"status"`
	Restrictions             []string `json:"restrictions"`
	CanMonetise              bool     `json:"canMonetise"`
	PreviousCanMonetise      bool     `json:"previousCanMonetise"`
	MonetisationChanged      bool     `json:"monetisationChanged"`
	MonetisationPauseReason  *string  `json:"monetisationPauseReason"`
	MonetisationOverride     *string  `json:"monetisationOverride"`
	CanGoLive                bool     `json:"canGoLive"`
	ActiveStrikeCount        int      `json:"activeStrikeCount"`
	CopyrightStrikesInWindow int      `json:"copyrightStrikesInWindow"`
	Reason                   string   `json:"reason"`
}

type StandingSnapshot struct {
	Input    StandingInput
	Standing Standing
	Strikes  []*ent.Strike
	Settings copyrightservices.PolicySettings
	Override *MonetisationOverride
}

func init() {
	strikeservices.ObserveStrikeChangesInTransaction(func(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time, reason string) error {
		_, err := EnqueueHealthChangedInTransaction(ctx, tx, accountId, now, reason)
		return err
	})
}

func LoadStanding(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (StandingSnapshot, error) {
	override, err := ReadMonetisationOverride(ctx, client, accountId)
	if err != nil {
		return StandingSnapshot{}, err
	}
	return LoadStandingWithOverride(ctx, client, accountId, now, override)
}

func LoadStandingWithOverride(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time, override *MonetisationOverride) (StandingSnapshot, error) {
	settings, err := copyrightservices.LoadPolicySettings(ctx, client)
	if err != nil {
		return StandingSnapshot{}, err
	}
	rows, err := client.Strike.Query().Where(strike.AccountID(accountId)).Order(ent.Desc(strike.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return StandingSnapshot{}, err
	}
	pending, err := client.CopyrightClaim.Query().Where(copyrightclaim.InfringerID(accountId), copyrightclaim.RemedyStateEQ(copyrightclaim.RemedyStateAwaitingRemoval), copyrightclaim.StatusIn(copyrightclaim.StatusUpheld, copyrightclaim.StatusCounterNotice)).Count(ctx)
	if err != nil {
		return StandingSnapshot{}, err
	}
	input := StandingInput{CopyrightStrikesInWindow: CountCopyrightStrikesInWindow(rows, now, settings.StrikeWindowDays), ActiveStrikes: CountActiveStrikes(rows, now), PendingTakedowns: pending}
	if !MonetisationOverrideStillApplies(override, input.ActiveStrikes) {
		override = nil
	}
	return StandingSnapshot{Input: input, Standing: ApplyMonetisationOverride(ComputeStanding(input, settings), override, input.ActiveStrikes), Strikes: rows, Settings: settings, Override: override}, nil
}

func EnqueueHealthChangedInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time, reason string) (StandingSnapshot, error) {
	state, err := LockMonetisationStateInTransaction(ctx, tx, accountId, now)
	if err != nil {
		return StandingSnapshot{}, err
	}
	stored := OverrideFromState(state)
	snapshot, err := LoadStandingWithOverride(ctx, tx.Client(), accountId, now, stored)
	if err != nil {
		return snapshot, err
	}
	if stored != nil && snapshot.Override == nil {
		if err := ClearMonetisationOverrideInTransaction(ctx, tx, accountId, now); err != nil {
			return snapshot, err
		}
		reason = ReasonOverrideCancelledByNewStrike
	}
	if err := tx.AccountMonetisationState.UpdateOneID(accountId).SetLastCanMonetise(snapshot.Standing.CanMonetise).SetLastPublishedAt(now).SetUpdatedAt(now).Exec(ctx); err != nil {
		return snapshot, err
	}
	var overrideMode *string
	if view := DescribeMonetisationOverride(snapshot.Override); view != nil {
		overrideMode = &view.Mode
	}
	return snapshot, events.EnqueueOutboxEventInTransaction(ctx, tx, AccountHealthChangedType, accountId.String(), now, AccountHealthChangedData{
		AccountId: accountId.String(), Status: snapshot.Standing.Status, Restrictions: snapshot.Standing.Restrictions, CanMonetise: snapshot.Standing.CanMonetise, PreviousCanMonetise: state.LastCanMonetise,
		MonetisationChanged: state.LastCanMonetise != snapshot.Standing.CanMonetise, MonetisationPauseReason: snapshot.Standing.MonetisationPause, MonetisationOverride: overrideMode,
		CanGoLive: snapshot.Standing.CanGoLive, ActiveStrikeCount: snapshot.Input.ActiveStrikes, CopyrightStrikesInWindow: snapshot.Input.CopyrightStrikesInWindow, Reason: reason,
	})
}

func PublishHealthChanged(ctx context.Context, c *container.Container, accountId uuid.UUID, reason string) (StandingSnapshot, error) {
	var snapshot StandingSnapshot
	err := c.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var enqueueErr error
		snapshot, enqueueErr = EnqueueHealthChangedInTransaction(ctx, tx, accountId, c.Now(), reason)
		return enqueueErr
	})
	return snapshot, err
}

func EnforceCopyrightStanding(ctx context.Context, c *container.Container, accountId uuid.UUID, triggeringStrikeId string) error {
	snapshot, err := LoadStanding(ctx, c.Client, accountId, c.Now())
	if err != nil {
		return err
	}
	if snapshot.Standing.Status == StatusRestricted {
		days := snapshot.Settings.RestrictionDays
		if err := c.Users.Enforce(ctx, integrations.EnforcementRequest{
			Action: "restrict", UserId: accountId.String(), Actor: integrations.StaffActor{Id: "system", Name: "Copyright policy", Role: "system"}, Features: []string{"POSTING", "GOING_LIVE", "SELLING"}, DurationDays: &days,
			Reason: "Repeated copyright infringement: posting, live, selling and monetisation are suspended", Source: "copyright", CaseId: triggeringStrikeId,
		}); err != nil {
			return err
		}
	}
	if !snapshot.Standing.NeedsSuspensionReview {
		return nil
	}
	reference, _ := json.Marshal(map[string]any{"strikeId": triggeringStrikeId, "copyrightStrikesInWindow": snapshot.Input.CopyrightStrikesInWindow})
	_, err = ingestsuspensioncase.Handler{Container: c}.Execute(ctx, ingestsuspensioncase.Command{
		AccountId: accountId.String(), Source: "copyright_strikes", RiskScore: min(100, snapshot.Input.CopyrightStrikesInWindow*25), TopSignals: []string{"repeat_copyright_infringer"},
		ReportCount: snapshot.Input.CopyrightStrikesInWindow, Signals: []json.RawMessage{reference}, ExternalReference: "copyright-strikes:" + triggeringStrikeId,
	})
	return err
}

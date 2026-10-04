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
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
)

const AccountHealthChangedType = "accountHealth.changed"

type AccountHealthChangedData struct {
	AccountId                string   `json:"accountId"`
	Status                   string   `json:"status"`
	Restrictions             []string `json:"restrictions"`
	CanMonetise              bool     `json:"canMonetise"`
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
}

func LoadStanding(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (StandingSnapshot, error) {
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
	return StandingSnapshot{Input: input, Standing: ComputeStanding(input, settings), Strikes: rows, Settings: settings}, nil
}

func PublishHealthChanged(ctx context.Context, c *container.Container, accountId uuid.UUID, reason string) (StandingSnapshot, error) {
	now := c.Now()
	snapshot, err := LoadStanding(ctx, c.Client, accountId, now)
	if err != nil {
		return snapshot, err
	}
	return snapshot, c.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, AccountHealthChangedType, accountId.String(), now, AccountHealthChangedData{
			AccountId: accountId.String(), Status: snapshot.Standing.Status, Restrictions: snapshot.Standing.Restrictions, CanMonetise: snapshot.Standing.CanMonetise, CanGoLive: snapshot.Standing.CanGoLive,
			ActiveStrikeCount: snapshot.Input.ActiveStrikes, CopyrightStrikesInWindow: snapshot.Input.CopyrightStrikesInWindow, Reason: reason,
		})
	})
}

func EnforceCopyrightStanding(ctx context.Context, c *container.Container, accountId uuid.UUID, triggeringStrikeId string) error {
	snapshot, err := PublishHealthChanged(ctx, c, accountId, "copyright_strike_issued")
	if err != nil {
		return err
	}
	if snapshot.Standing.Status == StatusRestricted {
		days := snapshot.Settings.RestrictionDays
		if err := c.Users.Enforce(ctx, integrations.EnforcementRequest{
			Action: "restrict", UserId: accountId.String(), Actor: integrations.StaffActor{Id: "system", Name: "Copyright policy", Role: "system"}, Features: []string{"GOING_LIVE"}, DurationDays: &days,
			Reason: "Repeated copyright strikes: monetisation and live are paused", Source: "copyright", CaseId: triggeringStrikeId,
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

package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/configs"
	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/securityaccountstate"
	"nantty/modules/moderation/src/generated/ent/securitycase"
	"nantty/modules/moderation/src/generated/ent/securityevent"
	"nantty/modules/moderation/src/integrations"
	"nantty/platform/httpserver"
)

type EventInput struct {
	AccountId         *uuid.UUID
	Kind              securityevent.Kind
	DeviceId          string
	IpPrefix          string
	Source            string
	ExternalReference string
	Detail            any
}

var SystemActor = integrations.StaffActor{Id: "system:go-trust", Name: "Nantty Security", Role: "system"}

func Thresholds(application *container.Container) configs.AccessSecuritySettings {
	return EffectiveThresholds(application.Settings.AccessSecurity)
}

func LockOrCreateAccountState(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) (*ent.SecurityAccountState, error) {
	for attempt := 0; attempt < 2; attempt++ {
		state, err := tx.SecurityAccountState.Query().Where(securityaccountstate.ID(accountId)).ForUpdate().Only(ctx)
		if err == nil {
			return state, nil
		}
		if !ent.IsNotFound(err) {
			return nil, err
		}
		created, err := tx.SecurityAccountState.Create().SetID(accountId).Save(ctx)
		if err == nil {
			return created, nil
		}
		if !ent.IsConstraintError(err) {
			return nil, err
		}
	}
	return nil, errors.New("could not lock the security state")
}

func IsAutoSuspensionActive(state *ent.SecurityAccountState, thresholds configs.AccessSecuritySettings, now time.Time) bool {
	return state.AutoSuspendedAt != nil && now.Before(state.AutoSuspendedAt.Add(time.Duration(thresholds.AutoSuspensionDays)*24*time.Hour))
}

func ReadRecentHistory(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, since time.Time) (RecentHistory, error) {
	rows, err := tx.SecurityEvent.Query().Where(securityevent.AccountID(accountId), securityevent.CreatedAtGTE(since), securityevent.KindIn(
		securityevent.KindAccessViolation, securityevent.KindChallengeRequired, securityevent.KindChallengePassed, securityevent.KindChallengeFailed,
	)).Select(securityevent.FieldKind).All(ctx)
	if err != nil {
		return RecentHistory{}, err
	}
	history := RecentHistory{}
	for _, row := range rows {
		switch row.Kind {
		case securityevent.KindAccessViolation:
			history.Violations++
		case securityevent.KindChallengeRequired:
			history.ChallengesRequired++
		case securityevent.KindChallengePassed:
			history.PassedChallenges++
		case securityevent.KindChallengeFailed:
			history.FailedChallenges++
		}
	}
	return history, nil
}

func ExternalReferenceAlreadyRecorded(ctx context.Context, tx *ent.Tx, reference string) (bool, error) {
	if reference == "" {
		return false, nil
	}
	return tx.SecurityEvent.Query().Where(securityevent.ExternalReference(reference)).Exist(ctx)
}

func RecordSecurityEvent(ctx context.Context, tx *ent.Tx, input EventInput, now time.Time) error {
	detail, err := json.Marshal(input.Detail)
	if err != nil {
		return err
	}
	create := tx.SecurityEvent.Create().SetKind(input.Kind).SetDeviceID(truncate(input.DeviceId, 128)).SetIPPrefix(truncate(input.IpPrefix, 64)).
		SetSource(truncate(input.Source, 40)).SetDetail(detail).SetCreatedAt(now).SetNillableAccountID(input.AccountId)
	if input.ExternalReference != "" {
		create.SetExternalReference(truncate(input.ExternalReference, 128))
	}
	return create.Exec(ctx)
}

func EnsureOpenCase(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, trigger securitycase.Trigger, now time.Time) (*ent.SecurityCase, error) {
	existing, err := tx.SecurityCase.Query().Where(securitycase.AccountID(accountId), securitycase.StatusEQ(securitycase.StatusOpen)).ForUpdate().Only(ctx)
	if err == nil {
		return existing, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	opened, err := tx.SecurityCase.Create().SetAccountID(accountId).SetTrigger(trigger).SetLastActivityAt(now).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := RecordSecurityEvent(ctx, tx, EventInput{AccountId: &accountId, Kind: securityevent.KindCaseOpened, Source: "go-trust", Detail: map[string]any{"caseId": opened.ID, "trigger": trigger}}, now); err != nil {
		return nil, err
	}
	return opened, events.EnqueueOutboxEventInTransaction(ctx, tx, "security.caseOpened", opened.ID.String(), now, map[string]any{"caseId": opened.ID.String(), "accountId": accountId.String(), "trigger": string(trigger)})
}

func OpenCaseForAccount(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) (*ent.SecurityCase, error) {
	row, err := tx.SecurityCase.Query().Where(securitycase.AccountID(accountId), securitycase.StatusEQ(securitycase.StatusOpen)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func SuspendAccountAutomatically(ctx context.Context, application *container.Container, accountId uuid.UUID) error {
	thresholds := Thresholds(application)
	days := thresholds.AutoSuspensionDays
	err := application.Users.Enforce(ctx, integrations.EnforcementRequest{
		Action: "suspend", UserId: accountId.String(), Actor: SystemActor, Reason: AutoSuspensionReason, ReasonCode: AutoSuspensionReasonCode, Source: AutoSuspensionSource, DurationDays: &days,
	})
	var apiError *httpserver.ApiError
	if err != nil && !(errors.As(err, &apiError) && apiError.Code == "ALREADY_SUSPENDED") {
		return err
	}
	now := application.Now()
	return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := LockOrCreateAccountState(ctx, tx, accountId)
		if err != nil {
			return err
		}
		if err := state.Update().SetAutoSuspendedAt(now).Exec(ctx); err != nil {
			return err
		}
		openCase, err := EnsureOpenCase(ctx, tx, accountId, securitycase.TriggerAccessProbing, now)
		if err != nil {
			return err
		}
		if err := openCase.Update().SetAutoSuspended(true).SetSeverity(securitycase.SeverityHigh).SetLastActivityAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := RecordSecurityEvent(ctx, tx, EventInput{AccountId: &accountId, Kind: securityevent.KindAutoSuspended, Source: "go-trust", Detail: map[string]any{"caseId": openCase.ID, "durationDays": days, "reason": AutoSuspensionReason}}, now); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "security.accountAutoSuspended", accountId.String(), now, map[string]any{
			"accountId": accountId.String(), "caseId": openCase.ID.String(), "reason": AutoSuspensionReason, "durationDays": days, "appealable": true,
		})
	})
}

func truncate(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}

package recordadevents

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/tracking/dtos"
	"nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

var botUserAgent = regexp.MustCompile(`(?i)bot|crawler|spider|headless|python-requests|curl/`)

type Handler struct{ Container *container.Container }

type eventOutcome int

const (
	outcomeAccepted eventOutcome = iota
	outcomeDuplicate
)

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.RecordAdEventsResponse, error) {
	response := dtos.RecordAdEventsResponse{Rejected: []dtos.RejectedEvent{}}
	for index, event := range command.Events {
		outcome, reason, err := handler.recordOne(ctx, command, event)
		switch {
		case err != nil:
			return response, err
		case reason != "":
			response.Rejected = append(response.Rejected, dtos.RejectedEvent{Index: index, Reason: reason})
		case outcome == outcomeDuplicate:
			response.Duplicates++
		default:
			response.Accepted++
		}
	}
	return response, nil
}

func (handler Handler) recordOne(ctx context.Context, command Command, event dtos.AdEventDto) (eventOutcome, string, error) {
	if !IsKnownEventType(event.Type) {
		return outcomeAccepted, "unknown_event_type", nil
	}
	claims, err := handler.Container.Signer.Verify(event.Token, command.UserId)
	if err != nil {
		return outcomeAccepted, tokenRejectionReason(err), nil
	}
	if event.Type == "skip" || event.Type == "hide" {
		return outcomeAccepted, "", handler.recordNegativeFeedback(ctx, claims)
	}
	if event.Type == "card_view" {
		return outcomeAccepted, "", handler.recordCardView(ctx, claims, event)
	}
	verdict, err := handler.evaluateFraud(ctx, command, claims, event)
	if err != nil {
		return outcomeAccepted, "", err
	}
	effects, duplicate, err := handler.applyInTransaction(ctx, claims, event, verdict)
	if err != nil {
		return outcomeAccepted, "", err
	}
	if effects.Charge.ChargeMicros > 0 {
		scope := services.SpendScope{AccountId: claims.AccountId, CampaignId: claims.CampaignId, AdGroupId: claims.AdGroupId, Day: services.DayKeyInTimezone(handler.Container.Now(), claims.Timezone), Month: handler.Container.Now().UTC().Format("2006-01")}
		if err := handler.Container.Spend.Add(ctx, scope, effects.Charge.ChargeMicros); err != nil {
			handler.Container.Logger.Warn("spend counter update failed; the next candidate refresh reseeds it", "error", err)
		}
	}
	if effects.CountClick && event.CardIndex != nil {
		handler.bumpCardStats(ctx, claims, *event.CardIndex, 0, 1)
	}
	if duplicate {
		return outcomeDuplicate, "", nil
	}
	return outcomeAccepted, "", nil
}

func tokenRejectionReason(err error) string {
	switch {
	case errors.Is(err, services.ErrAdTokenExpired):
		return "token_expired"
	case errors.Is(err, services.ErrAdTokenUserMismatch):
		return "token_user_mismatch"
	default:
		return "token_invalid"
	}
}

func (handler Handler) recordNegativeFeedback(ctx context.Context, claims services.AdTokenClaims) error {
	policies, err := handler.Container.Policies.FrequencyPolicies(ctx)
	if err != nil {
		return err
	}
	return handler.Container.Frequency.RecordSkipCooldown(ctx, claims.UserId, policies[claims.Placement])
}

func (handler Handler) evaluateFraud(ctx context.Context, command Command, claims services.AdTokenClaims, event dtos.AdEventDto) (services.FraudVerdict, error) {
	signals := services.FraudSignals{EventKind: event.Type, MillisSinceServed: handler.Container.Now().UnixMilli() - claims.IssuedAtUnix*1000, KnownBotUserAgent: botUserAgent.MatchString(command.UserAgent)}
	if event.Type == "click" {
		minute := fmt.Sprintf("clk:%s:%d", claims.UserId, handler.Container.Now().Unix()/60)
		clicks, err := handler.Container.Counters.Increment(ctx, minute, 1, 2*time.Minute)
		if err != nil {
			return services.FraudVerdict{}, err
		}
		signals.ClicksByViewerLastMinute = int(clicks)
	}
	if event.Type == "click" {
		score, _ := handler.Container.FraudModel.ScoreAdEvent(ctx, claims.ImpressionId, claims.UserId, strings.ToLower(event.Type), types.AdClickSignals{ClicksByActorLastMinute: signals.ClicksByViewerLastMinute, MillisecondsFromImpression: signals.MillisSinceServed})
		signals.ModelScore = score
	}
	return services.EvaluateFraudPolicy(signals, services.DefaultFraudThresholds()), nil
}

package decideadforslot

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/decision/dtos"
	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

type slotContext struct {
	command   Command
	placement string
	now       time.Time
	signal    *types.ContentSignal
	formatCap services.FrequencyPolicy
	totalCap  services.FrequencyPolicy
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	deployed := handler.Container
	placement, _ := services.PlacementForSlotKind(command.Slot.Kind)
	if !slices.Contains(deployed.Settings.EnabledPlacements, placement) {
		return decline("placement_disabled"), nil
	}
	slot := &slotContext{command: command, placement: placement, now: deployed.Now()}
	if reason, err := handler.checkViewerEligibility(ctx, slot); reason != "" || err != nil {
		return decline(reason), err
	}
	if reason, err := handler.checkContentEligibility(ctx, slot); reason != "" || err != nil {
		return decline(reason), err
	}
	if reason, err := handler.checkUserExperienceGuard(ctx, slot); reason != "" || err != nil {
		return decline(reason), err
	}
	eligible, err := handler.collectEligibleCandidates(ctx, slot)
	if err != nil || len(eligible) == 0 {
		return decline("no_eligible_ad"), err
	}
	return handler.runAuctionAndIssueToken(ctx, slot, eligible)
}

func decline(reason string) Result { return Result{DeclinedReason: reason} }

func (handler Handler) runAuctionAndIssueToken(ctx context.Context, slot *slotContext, eligible []types.CandidateAd) (Result, error) {
	deployed := handler.Container
	outcome, winner, pctr, ok, err := handler.scoreAndAuction(ctx, slot, eligible)
	if err != nil || !ok {
		return decline("auction_no_winner"), err
	}
	newReach, err := deployed.Frequency.Record(ctx, scopeFor(slot, winner))
	if err != nil {
		return Result{}, err
	}
	impressionId, _ := uuid.NewV7()
	claims := handler.buildClaims(ctx, slot, winner, outcome, pctr, impressionId.String(), newReach)
	token, err := deployed.Signer.Sign(claims)
	if err != nil {
		return Result{}, err
	}
	return Result{Ad: &dtos.DecidedAd{
		AdId: winner.AdId, ImpressionToken: token, ExpiresAt: deployed.Now().Add(deployed.Settings.AdTokenTimeToLive).UTC().Format(time.RFC3339),
		Placement: slot.placement, SlotKind: slot.command.Slot.Kind, Format: winner.Format, Label: "Ad", Creative: winner.Creative, SkipAfterSeconds: skipAfter(slot, deployed.Settings.SkipAfterSeconds),
	}}, nil
}

func skipAfter(slot *slotContext, seconds int) *int {
	if services.IsContentAdjacentSlot(slot.command.Slot.Kind) {
		return &seconds
	}
	return nil
}

func scopeFor(slot *slotContext, candidate types.CandidateAd) services.FrequencyScope {
	return services.FrequencyScope{
		UserId: slot.command.UserId, SessionId: slot.command.SessionId, Format: slot.placement, AccountId: candidate.AccountId, AdGroupId: candidate.AdGroupId,
		GroupCapImpressions: candidate.FrequencyImpressions, GroupCapPerDays: candidate.FrequencyPerDays, Now: slot.now,
	}
}

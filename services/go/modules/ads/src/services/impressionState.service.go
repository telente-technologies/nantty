package services

const (
	EventKindImpression = "impression"
	EventKindView       = "view"
	EventKindComplete   = "complete"
	EventKindClick      = "click"
	minimumVideoViewMs  = 2_000
)

type ImpressionState struct {
	Viewed      bool
	WatchMs     int
	Completed   bool
	ClickCount  int
	Qualified   bool
	FraudStatus string
	Charged     bool
}

type AdEventInput struct {
	Kind           string
	WatchMs        int
	VisiblePercent int
	Verdict        FraudVerdict
}

type EventEffects struct {
	CountImpression bool
	CountVideoView  bool
	CountClick      bool
	NowQualified    bool
	WatchMsDelta    int
	Charge          RevenueSplit
	InvalidReason   string
}

func ApplyAdEventToImpression(state ImpressionState, claims AdTokenClaims, input AdEventInput) (ImpressionState, EventEffects) {
	var effects EventEffects
	if state.FraudStatus == "" {
		state.FraudStatus = "pending"
	}
	if input.Verdict.Status == FraudStatusInvalid && state.FraudStatus != FraudStatusInvalid && !state.Charged {
		state.FraudStatus = FraudStatusInvalid
		effects.InvalidReason = input.Verdict.Reason
	}
	if state.FraudStatus == FraudStatusInvalid {
		return state, effects
	}
	if !state.Viewed {
		state.Viewed, effects.CountImpression = true, true
	}
	if input.Kind == EventKindView || input.Kind == EventKindComplete {
		applyViewProgress(&state, claims, input, &effects)
	}
	if input.Kind == EventKindClick {
		applyClick(&state, claims, &effects)
	}
	if state.FraudStatus == "pending" && input.Verdict.Status == FraudStatusClean && input.Kind != EventKindImpression {
		state.FraudStatus = FraudStatusClean
	}
	return state, effects
}

func applyViewProgress(state *ImpressionState, claims AdTokenClaims, input AdEventInput, effects *EventEffects) {
	if input.WatchMs > state.WatchMs {
		effects.WatchMsDelta = input.WatchMs - state.WatchMs
		state.WatchMs = input.WatchMs
	}
	if input.Kind == EventKindComplete {
		state.Completed = true
	}
	if state.WatchMs >= minimumVideoViewMs && effects.WatchMsDelta > 0 && state.WatchMs-effects.WatchMsDelta < minimumVideoViewMs {
		effects.CountVideoView = true
	}
	if !state.Qualified && IsViewQualified(claims, state.WatchMs, input.VisiblePercent, state.Completed) {
		state.Qualified, effects.NowQualified = true, true
		if claims.Basis == BasisCpm {
			chargeOnce(state, claims, effects)
		}
	}
}

func applyClick(state *ImpressionState, claims AdTokenClaims, effects *EventEffects) {
	state.ClickCount++
	if state.ClickCount > 1 {
		return
	}
	effects.CountClick = true
	if claims.Basis == BasisCpc {
		chargeOnce(state, claims, effects)
	}
}

func chargeOnce(state *ImpressionState, claims AdTokenClaims, effects *EventEffects) {
	if state.Charged || claims.PriceMicros <= 0 {
		return
	}
	state.Charged = true
	effects.Charge = SplitRevenueBetweenCreatorAndPlatform(claims.PriceMicros, claims.CreatorShareBps, claims.MultiplierBps, claims.CreatorUserId != "")
}

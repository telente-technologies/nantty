package getsecuritycase

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/securityaccountstate"
	"zudomart/modules/moderation/src/generated/ent/securitycase"
	"zudomart/modules/moderation/src/generated/ent/securityevent"
	"zudomart/modules/moderation/src/modules/accessSecurity/services"
	"zudomart/platform/httpserver"
)

const timelineLimit = 300

type AccountSecurityState struct {
	ChallengeRequired  bool     `json:"challengeRequired"`
	SuspectedBot       bool     `json:"suspectedBot"`
	BotScore           float64  `json:"botScore"`
	BotReasons         []string `json:"botReasons"`
	HeadlessReported   bool     `json:"headlessReported"`
	AttestationVerdict string   `json:"attestationVerdict"`
	AutoSuspendedAt    *string  `json:"autoSuspendedAt"`
}

type Result struct {
	services.CaseSummary
	State            AccountSecurityState     `json:"state"`
	Timeline         []services.TimelineEntry `json:"timeline"`
	ChallengeHistory []services.TimelineEntry `json:"challengeHistory"`
	LinkedDevices    []string                 `json:"linkedDevices"`
	LinkedIpPrefixes []string                 `json:"linkedIpPrefixes"`
	PreviousCases    int                      `json:"previousCases"`
	AutomationNote   string                   `json:"automationNote"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawCaseId string) (Result, error) {
	identifier, err := uuid.Parse(rawCaseId)
	if err != nil {
		return Result{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.SecurityCase.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return Result{}, httpserver.ErrNotFound
	}
	if err != nil {
		return Result{}, err
	}
	summaries, err := services.BuildCaseSummaries(ctx, handler.Container, []*ent.SecurityCase{row})
	if err != nil {
		return Result{}, err
	}
	events, err := handler.Container.Client.SecurityEvent.Query().Where(securityevent.AccountID(row.AccountID)).Order(ent.Desc(securityevent.FieldCreatedAt)).Limit(timelineLimit).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{CaseSummary: summaries[0], Timeline: services.BuildTimeline(events), LinkedDevices: []string{}, LinkedIpPrefixes: []string{}, ChallengeHistory: []services.TimelineEntry{},
		AutomationNote: "Automation stops at a temporary suspension. Banning or deleting this account is a staff decision made here after reviewing the evidence."}
	for _, entry := range result.Timeline {
		if entry.DeviceId != "" && !slices.Contains(result.LinkedDevices, entry.DeviceId) {
			result.LinkedDevices = append(result.LinkedDevices, entry.DeviceId)
		}
		if entry.IpPrefix != "" && !slices.Contains(result.LinkedIpPrefixes, entry.IpPrefix) {
			result.LinkedIpPrefixes = append(result.LinkedIpPrefixes, entry.IpPrefix)
		}
		if entry.Kind == string(securityevent.KindChallengePassed) || entry.Kind == string(securityevent.KindChallengeFailed) || entry.Kind == string(securityevent.KindChallengeRequired) {
			result.ChallengeHistory = append(result.ChallengeHistory, entry)
		}
	}
	result.PreviousCases, _ = handler.Container.Client.SecurityCase.Query().Where(securitycase.AccountID(row.AccountID), securitycase.IDNEQ(row.ID)).Count(ctx)
	state, err := handler.Container.Client.SecurityAccountState.Query().Where(securityaccountstate.ID(row.AccountID)).Only(ctx)
	if err == nil {
		result.State = AccountSecurityState{ChallengeRequired: state.ChallengeRequired, SuspectedBot: state.SuspectedBot, BotScore: state.BotScore, BotReasons: state.BotReasons, HeadlessReported: state.HeadlessReported, AttestationVerdict: state.AttestationVerdict}
		if state.AutoSuspendedAt != nil {
			formatted := state.AutoSuspendedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
			result.State.AutoSuspendedAt = &formatted
		}
	} else if !ent.IsNotFound(err) {
		return Result{}, err
	}
	if result.State.BotReasons == nil {
		result.State.BotReasons = []string{}
	}
	return result, nil
}

package services

import (
	"context"
	"nantty/modules/live/src/types"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
)

func (service *LiveService) attachBattleToStage(ctx context.Context, db *ent.Client, view *types.LiveStageView, shown *ent.Battle, forfeited map[uuid.UUID]bool, now time.Time) error {
	rows, err := db.BattleParticipant.Query().Where(battleparticipant.BattleID(shown.ID)).Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if row.State != battleparticipant.StateActive {
			forfeited[row.UserID] = true
		}
	}
	if shown.State == battlerecord.StatePending {
		proposal, err := service.presentProposal(ctx, shown, rows, now)
		view.BattleProposal = &proposal
		return err
	}
	battleView, err := service.presentBattle(ctx, db, shown)
	if err != nil {
		return err
	}
	view.ActiveBattle = &battleView
	view.RecentBattleGifts, err = service.loadRecentBattleGifts(ctx, db, shown.ID)
	return err
}

func (service *LiveService) presentProposal(ctx context.Context, battle *ent.Battle, rows []*ent.BattleParticipant, now time.Time) (types.BattleProposalView, error) {
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.UserID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return types.BattleProposalView{}, err
	}
	view := types.BattleProposalView{
		Id: battle.ID.String(), WinnerTakesAll: true, DurationSeconds: battle.DurationSeconds, Participants: []types.UserSummary{}, Consents: []types.ProposalConsentView{},
	}
	if battle.ProposalExpiresAt != nil {
		view.ExpiresAt = formatTime(*battle.ProposalExpiresAt)
	}
	consents := []string{}
	for _, row := range rows {
		view.Participants = append(view.Participants, summarise(participants[row.UserID]))
		view.Consents = append(view.Consents, types.ProposalConsentView{UserId: row.UserID.String(), State: string(row.Consent)})
		consents = append(consents, string(row.Consent))
	}
	view.NeedsHostDecision = JudgeWinnerTakesAllConsents(consents) == ConsentDeclined
	return view, nil
}

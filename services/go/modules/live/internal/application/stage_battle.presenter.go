package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
)

func (application *LiveApplication) attachBattleToStage(ctx context.Context, db *ent.Client, view *LiveStageView, shown *ent.Battle, forfeited map[uuid.UUID]bool, now time.Time) error {
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
		proposal, err := application.presentProposal(ctx, shown, rows, now)
		view.BattleProposal = &proposal
		return err
	}
	battleView, err := application.presentBattle(ctx, db, shown)
	if err != nil {
		return err
	}
	view.ActiveBattle = &battleView
	view.RecentBattleGifts, err = application.loadRecentBattleGifts(ctx, db, shown.ID)
	return err
}

func (application *LiveApplication) presentProposal(ctx context.Context, battle *ent.Battle, rows []*ent.BattleParticipant, now time.Time) (BattleProposalView, error) {
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.UserID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return BattleProposalView{}, err
	}
	view := BattleProposalView{
		Id: battle.ID.String(), WinnerTakesAll: true, DurationSeconds: battle.DurationSeconds, Participants: []UserSummary{}, Consents: []ProposalConsentView{},
	}
	if battle.ProposalExpiresAt != nil {
		view.ExpiresAt = formatTime(*battle.ProposalExpiresAt)
	}
	consents := []string{}
	for _, row := range rows {
		view.Participants = append(view.Participants, summarise(participants[row.UserID]))
		view.Consents = append(view.Consents, ProposalConsentView{UserId: row.UserID.String(), State: string(row.Consent)})
		consents = append(consents, string(row.Consent))
	}
	view.NeedsHostDecision = domain.JudgeWinnerTakesAllConsents(consents) == domain.ConsentDeclined
	return view, nil
}

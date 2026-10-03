package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/gifttransaction"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/joinrequest"
	"zudomart/modules/live/internal/ports"
)

const (
	battleHistoryLimit     = 5
	recentBattleGiftsLimit = 12
	phaseIdle              = "idle"
	phaseInviting          = "inviting"
	phaseOnStage           = "onStage"
	phaseBattlePending     = "battlePending"
	phaseBattleCountdown   = "battleCountdown"
	phaseBattling          = "battling"
	phaseSettling          = "settling"
	phaseResult            = "result"
)

func (application *LiveApplication) GetLiveStage(ctx context.Context, liveId uuid.UUID, viewer *uuid.UUID) (LiveStageView, error) {
	return application.buildStageView(ctx, application.Client, liveId, viewer)
}

func (application *LiveApplication) buildStageView(ctx context.Context, db *ent.Client, liveId uuid.UUID, viewer *uuid.UUID) (LiveStageView, error) {
	session, err := db.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return LiveStageView{}, errLiveNotFound
	}
	if err != nil {
		return LiveStageView{}, err
	}
	slots, err := db.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Order(ent.Asc(guestslot.FieldCreatedAt)).All(ctx)
	if err != nil {
		return LiveStageView{}, err
	}
	requests, err := db.JoinRequest.Query().Where(joinrequest.LiveID(liveId), joinrequest.StateEQ(joinrequest.StatePending)).Order(ent.Asc(joinrequest.FieldCreatedAt)).All(ctx)
	if err != nil {
		return LiveStageView{}, err
	}
	now := application.Now()
	shown, err := db.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.Or(
		battlerecord.StateIn(battlerecord.StatePending, battlerecord.StateCountdown, battlerecord.StateActive, battlerecord.StateEnded),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateSettled), battlerecord.EndsAtGT(now.Add(-(domain.BattleSettlingDisplaySeconds+domain.BattleResultDisplaySeconds)*time.Second))),
	)).Order(ent.Desc(battlerecord.FieldCreatedAt)).First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return LiveStageView{}, err
	}
	view, err := application.assembleStage(ctx, db, session, slots, requests, shown, viewer, now)
	return view, err
}

func occupyingSlotStates() []guestslot.State {
	return []guestslot.State{guestslot.StateInvited, guestslot.StateJoining, guestslot.StateOnStage, guestslot.StateReconnecting}
}

func (application *LiveApplication) assembleStage(ctx context.Context, db *ent.Client, session *ent.LiveSession, slots []*ent.GuestSlot, requests []*ent.JoinRequest, shown *ent.Battle, viewer *uuid.UUID, now time.Time) (LiveStageView, error) {
	identifiers := []uuid.UUID{session.HostID}
	for _, slot := range slots {
		identifiers = append(identifiers, slot.UserID)
	}
	for _, request := range requests {
		identifiers = append(identifiers, request.UserID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return LiveStageView{}, err
	}
	summaries := summariesById(participants)
	view := LiveStageView{
		LiveId: session.ID.String(), ServerNow: formatTime(now), MyRole: "viewer", Streamers: []StageStreamer{}, Invitations: []GuestSlotView{},
		JoinRequests: []JoinRequestView{}, RecentBattleGifts: []BattleGiftEventView{}, BattleHistory: []BattleView{},
	}
	if viewer != nil && *viewer == session.HostID {
		view.MyRole = "host"
	}
	forfeited := map[uuid.UUID]bool{}
	if shown != nil {
		if err := application.attachBattleToStage(ctx, db, &view, shown, forfeited, now); err != nil {
			return LiveStageView{}, err
		}
	}
	application.attachSlots(&view, slots, participants, summaries, forfeited, viewer, session.HostID)
	application.attachJoinRequests(&view, requests, summaries, viewer, session.HostID)
	view.Layout = describeLayout(view)
	view.Phase = describePhase(view, shown)
	return view, application.attachHistory(ctx, db, &view, shown)
}

func (application *LiveApplication) attachSlots(view *LiveStageView, slots []*ent.GuestSlot, participants map[uuid.UUID]ports.Participant, summaries map[uuid.UUID]UserSummary, forfeited map[uuid.UUID]bool, viewer *uuid.UUID, hostId uuid.UUID) {
	position := 0
	for _, slot := range slots {
		state := domain.GuestSlotState(slot.State)
		if domain.IsGuestSlotVisibleOnStage(state) {
			if viewer != nil && *viewer == slot.UserID && view.MyRole == "viewer" {
				view.MyRole = "guest"
			}
			view.Streamers = append(view.Streamers, StageStreamer{
				SlotId: slot.ID.String(), User: summaries[slot.UserID], Role: string(slot.Role), State: string(slot.State),
				AudioMuted: slot.AudioMutedByHost || slot.AudioMutedBySelf, VideoMuted: slot.VideoMutedByHost || slot.VideoMutedBySelf,
				GiftEligible: !forfeited[slot.UserID], IsCreatorProgramMember: participants[slot.UserID].IsCreatorProgramMember, Position: position,
			})
			position++
			continue
		}
		slotView := presentGuestSlot(slot, summaries[slot.UserID], len(view.Invitations))
		switch {
		case viewer != nil && *viewer == slot.UserID && state == domain.SlotInvited:
			view.InvitationForMe = &slotView
		case viewer != nil && *viewer == hostId && state == domain.SlotInvited:
			view.Invitations = append(view.Invitations, slotView)
		}
	}
}

func presentGuestSlot(slot *ent.GuestSlot, user UserSummary, position int) GuestSlotView {
	return GuestSlotView{
		Id: slot.ID.String(), LiveId: slot.LiveID.String(), User: user, State: string(slot.State), InvitedAt: formatTime(slot.CreatedAt),
		ExpiresAt: formatTime(slot.ExpiresAt), JoinedAt: formatOptionalTime(slot.JoinedAt), LeftAt: formatOptionalTime(slot.LeftAt),
		AudioMutedByHost: slot.AudioMutedByHost, VideoMutedByHost: slot.VideoMutedByHost, Position: position,
	}
}

func (application *LiveApplication) attachJoinRequests(view *LiveStageView, requests []*ent.JoinRequest, summaries map[uuid.UUID]UserSummary, viewer *uuid.UUID, hostId uuid.UUID) {
	for _, request := range requests {
		requestView := JoinRequestView{Id: request.ID.String(), User: summaries[request.UserID], State: string(request.State), RequestedAt: formatTime(request.CreatedAt)}
		if viewer != nil && *viewer == request.UserID {
			view.MyJoinRequest = &requestView
		}
		if viewer != nil && *viewer == hostId {
			view.JoinRequests = append(view.JoinRequests, requestView)
		}
	}
}

func describeLayout(view LiveStageView) string {
	if view.ActiveBattle != nil {
		return "battle"
	}
	if len(view.Streamers) <= 1 {
		return "spotlight"
	}
	return "grid"
}

func describePhase(view LiveStageView, shown *ent.Battle) string {
	if view.BattleProposal != nil {
		return phaseBattlePending
	}
	if shown != nil {
		switch shown.State {
		case battlerecord.StateCountdown:
			return phaseBattleCountdown
		case battlerecord.StateActive:
			return phaseBattling
		case battlerecord.StateEnded:
			return phaseSettling
		case battlerecord.StateSettled:
			return phaseResult
		}
	}
	if len(view.Streamers) > 1 {
		return phaseOnStage
	}
	if len(view.Invitations) > 0 {
		return phaseInviting
	}
	return phaseIdle
}

func (application *LiveApplication) attachHistory(ctx context.Context, db *ent.Client, view *LiveStageView, shown *ent.Battle) error {
	query := db.Battle.Query().Where(battlerecord.LiveID(uuid.MustParse(view.LiveId)), battlerecord.StateEQ(battlerecord.StateSettled))
	if shown != nil {
		query = query.Where(battlerecord.IDNEQ(shown.ID))
	}
	rows, err := query.Order(ent.Desc(battlerecord.FieldCreatedAt)).Limit(battleHistoryLimit).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		battleView, err := application.presentBattle(ctx, db, row)
		if err != nil {
			return err
		}
		view.BattleHistory = append(view.BattleHistory, battleView)
	}
	return nil
}

func (application *LiveApplication) loadRecentBattleGifts(ctx context.Context, db *ent.Client, battleId uuid.UUID) ([]BattleGiftEventView, error) {
	rows, err := db.GiftTransaction.Query().Where(gifttransaction.BattleID(battleId)).Order(ent.Desc(gifttransaction.FieldCreatedAt)).Limit(recentBattleGiftsLimit).All(ctx)
	if err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.SenderID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return nil, err
	}
	events := make([]BattleGiftEventView, 0, len(rows))
	for index := len(rows) - 1; index >= 0; index-- {
		row := rows[index]
		events = append(events, BattleGiftEventView{Id: row.ID.String(), Sender: summarise(participants[row.SenderID]), RecipientUserId: row.ReceiverID.String(), GiftEmoji: giftGlyph(row.GiftID), Coins: row.TotalCoins})
	}
	return events, nil
}

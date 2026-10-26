package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battlegiftevent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/joinrequest"
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

func (service *LiveService) GetLiveStage(ctx context.Context, liveId uuid.UUID, viewer *uuid.UUID) (types.LiveStageView, error) {
	return service.buildStageView(ctx, service.Client, liveId, viewer)
}

func (service *LiveService) buildStageView(ctx context.Context, db *ent.Client, liveId uuid.UUID, viewer *uuid.UUID) (types.LiveStageView, error) {
	session, err := db.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.LiveStageView{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return types.LiveStageView{}, err
	}
	slots, err := db.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Order(ent.Asc(guestslot.FieldCreatedAt)).All(ctx)
	if err != nil {
		return types.LiveStageView{}, err
	}
	requests, err := db.JoinRequest.Query().Where(joinrequest.LiveID(liveId), joinrequest.StateEQ(joinrequest.StatePending)).Order(ent.Asc(joinrequest.FieldCreatedAt)).All(ctx)
	if err != nil {
		return types.LiveStageView{}, err
	}
	now := service.Now()
	shown, err := db.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.Or(
		battlerecord.StateIn(battlerecord.StatePending, battlerecord.StateCountdown, battlerecord.StateActive, battlerecord.StateEnded),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateSettled), battlerecord.EndsAtGT(now.Add(-(BattleSettlingDisplaySeconds+BattleResultDisplaySeconds)*time.Second))),
	)).Order(ent.Desc(battlerecord.FieldCreatedAt)).First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return types.LiveStageView{}, err
	}
	view, err := service.assembleStage(ctx, db, session, slots, requests, shown, viewer, now)
	return view, err
}

func occupyingSlotStates() []guestslot.State {
	return []guestslot.State{guestslot.StateInvited, guestslot.StateJoining, guestslot.StateOnStage, guestslot.StateReconnecting}
}

func (service *LiveService) assembleStage(ctx context.Context, db *ent.Client, session *ent.LiveSession, slots []*ent.GuestSlot, requests []*ent.JoinRequest, shown *ent.Battle, viewer *uuid.UUID, now time.Time) (types.LiveStageView, error) {
	identifiers := []uuid.UUID{session.HostID}
	for _, slot := range slots {
		identifiers = append(identifiers, slot.UserID)
	}
	for _, request := range requests {
		identifiers = append(identifiers, request.UserID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return types.LiveStageView{}, err
	}
	summaries := summariesById(participants)
	view := types.LiveStageView{
		LiveId: session.ID.String(), ServerNow: formatTime(now), MyRole: "viewer", Streamers: []types.StageStreamer{}, Invitations: []types.GuestSlotView{},
		JoinRequests: []types.JoinRequestView{}, RecentBattleGifts: []types.BattleGiftEventView{}, BattleHistory: []types.BattleView{},
	}
	if viewer != nil && *viewer == session.HostID {
		view.MyRole = "host"
	}
	forfeited := map[uuid.UUID]bool{}
	if shown != nil {
		if err := service.attachBattleToStage(ctx, db, &view, shown, forfeited, now); err != nil {
			return types.LiveStageView{}, err
		}
	}
	service.attachSlots(&view, slots, participants, summaries, forfeited, viewer, session.HostID)
	service.attachJoinRequests(&view, requests, summaries, viewer, session.HostID)
	view.Layout = describeLayout(view)
	view.Phase = describePhase(view, shown)
	return view, service.attachHistory(ctx, db, &view, shown)
}

func (service *LiveService) attachSlots(view *types.LiveStageView, slots []*ent.GuestSlot, participants map[uuid.UUID]interfaces.Participant, summaries map[uuid.UUID]types.UserSummary, forfeited map[uuid.UUID]bool, viewer *uuid.UUID, hostId uuid.UUID) {
	position := 0
	for _, slot := range slots {
		state := GuestSlotState(slot.State)
		if IsGuestSlotVisibleOnStage(state) {
			if viewer != nil && *viewer == slot.UserID && view.MyRole == "viewer" {
				view.MyRole = "guest"
			}
			view.Streamers = append(view.Streamers, types.StageStreamer{
				SlotId: slot.ID.String(), User: summaries[slot.UserID], Role: string(slot.Role), State: string(slot.State),
				AudioMuted: slot.AudioMutedByHost || slot.AudioMutedBySelf, VideoMuted: slot.VideoMutedByHost || slot.VideoMutedBySelf,
				GiftEligible: !forfeited[slot.UserID], IsCreatorProgramMember: participants[slot.UserID].IsCreatorProgramMember, Position: position,
			})
			position++
			continue
		}
		slotView := presentGuestSlot(slot, summaries[slot.UserID], len(view.Invitations))
		switch {
		case viewer != nil && *viewer == slot.UserID && state == SlotInvited:
			view.InvitationForMe = &slotView
		case viewer != nil && *viewer == hostId && state == SlotInvited:
			view.Invitations = append(view.Invitations, slotView)
		}
	}
}

func presentGuestSlot(slot *ent.GuestSlot, user types.UserSummary, position int) types.GuestSlotView {
	return types.GuestSlotView{
		Id: slot.ID.String(), LiveId: slot.LiveID.String(), User: user, State: string(slot.State), InvitedAt: formatTime(slot.CreatedAt),
		ExpiresAt: formatTime(slot.ExpiresAt), JoinedAt: formatOptionalTime(slot.JoinedAt), LeftAt: formatOptionalTime(slot.LeftAt),
		AudioMutedByHost: slot.AudioMutedByHost, VideoMutedByHost: slot.VideoMutedByHost, Position: position,
	}
}

func (service *LiveService) attachJoinRequests(view *types.LiveStageView, requests []*ent.JoinRequest, summaries map[uuid.UUID]types.UserSummary, viewer *uuid.UUID, hostId uuid.UUID) {
	for _, request := range requests {
		requestView := types.JoinRequestView{Id: request.ID.String(), User: summaries[request.UserID], State: string(request.State), RequestedAt: formatTime(request.CreatedAt)}
		if viewer != nil && *viewer == request.UserID {
			view.MyJoinRequest = &requestView
		}
		if viewer != nil && *viewer == hostId {
			view.JoinRequests = append(view.JoinRequests, requestView)
		}
	}
}

func describeLayout(view types.LiveStageView) string {
	if view.ActiveBattle != nil {
		return "battle"
	}
	if len(view.Streamers) <= 1 {
		return "spotlight"
	}
	return "grid"
}

func describePhase(view types.LiveStageView, shown *ent.Battle) string {
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

func (service *LiveService) attachHistory(ctx context.Context, db *ent.Client, view *types.LiveStageView, shown *ent.Battle) error {
	query := db.Battle.Query().Where(battlerecord.LiveID(uuid.MustParse(view.LiveId)), battlerecord.StateEQ(battlerecord.StateSettled))
	if shown != nil {
		query = query.Where(battlerecord.IDNEQ(shown.ID))
	}
	rows, err := query.Order(ent.Desc(battlerecord.FieldCreatedAt)).Limit(battleHistoryLimit).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		battleView, err := service.presentBattle(ctx, db, row)
		if err != nil {
			return err
		}
		view.BattleHistory = append(view.BattleHistory, battleView)
	}
	return nil
}

func (service *LiveService) loadRecentBattleGifts(ctx context.Context, db *ent.Client, battleId uuid.UUID) ([]types.BattleGiftEventView, error) {
	rows, err := db.BattleGiftEvent.Query().Where(battlegiftevent.BattleID(battleId)).Order(ent.Desc(battlegiftevent.FieldCreatedAt)).Limit(recentBattleGiftsLimit).All(ctx)
	if err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.SenderID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return nil, err
	}
	events := make([]types.BattleGiftEventView, 0, len(rows))
	for index := len(rows) - 1; index >= 0; index-- {
		row := rows[index]
		events = append(events, types.BattleGiftEventView{Id: row.ID.String(), Sender: summarise(participants[row.SenderID]), RecipientUserId: row.ReceiverID.String(), GiftEmoji: giftGlyph(row.GiftID), Coins: row.Coins})
	}
	return events, nil
}

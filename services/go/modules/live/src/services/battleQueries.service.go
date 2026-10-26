package services

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

func (service *LiveService) GetBattle(ctx context.Context, viewer, battleId uuid.UUID) (types.BattleView, error) {
	battle, err := service.Client.Battle.Get(ctx, battleId)
	if ent.IsNotFound(err) {
		return types.BattleView{}, liveerrors.BattleNotFound
	}
	if err != nil {
		return types.BattleView{}, err
	}
	session, err := service.Client.LiveSession.Get(ctx, battle.LiveID)
	if err != nil {
		return types.BattleView{}, err
	}
	if err := service.requireLiveAccess(ctx, session, viewer); err != nil {
		return types.BattleView{}, err
	}
	return service.presentBattle(ctx, service.Client, battle)
}

func (service *LiveService) hostBattleResults(ctx context.Context, liveId, hostId uuid.UUID) ([]types.StreamBattleResultView, error) {
	battles, err := service.Client.Battle.Query().
		Where(battlerecord.LiveID(liveId), battlerecord.StateIn(battlerecord.StateEnded, battlerecord.StateSettled)).
		Order(ent.Asc(battlerecord.FieldCreatedAt)).All(ctx)
	if err != nil || len(battles) == 0 {
		return []types.StreamBattleResultView{}, err
	}
	identifiers := make([]uuid.UUID, len(battles))
	for index, battle := range battles {
		identifiers[index] = battle.ID
	}
	rows, err := service.Client.BattleParticipant.Query().Where(battleparticipant.BattleIDIn(identifiers...)).
		Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	byBattle := map[uuid.UUID][]*ent.BattleParticipant{}
	opponents := []uuid.UUID{}
	for _, row := range rows {
		byBattle[row.BattleID] = append(byBattle[row.BattleID], row)
		if row.UserID != hostId {
			opponents = append(opponents, row.UserID)
		}
	}
	participants, err := service.lookupParticipants(ctx, opponents...)
	if err != nil {
		return nil, err
	}
	results := []types.StreamBattleResultView{}
	for _, battle := range battles {
		if result, hosted := summariseHostBattle(battle.ID, hostId, byBattle[battle.ID], participants); hosted {
			results = append(results, result)
		}
	}
	return results, nil
}

func summariseHostBattle(battleId, hostId uuid.UUID, rows []*ent.BattleParticipant, participants map[uuid.UUID]interfaces.Participant) (types.StreamBattleResultView, bool) {
	result := types.StreamBattleResultView{Id: battleId.String()}
	hosted, names := false, []string{}
	for _, row := range rows {
		if row.UserID == hostId {
			hosted, result.CoinsFor = true, row.Score
			continue
		}
		names = append(names, participants[row.UserID].Name)
		result.CoinsAgainst = max(result.CoinsAgainst, row.Score)
	}
	result.OpponentName = joinOpponentNames(names)
	return result, hosted && len(names) > 0
}

func joinOpponentNames(names []string) string {
	switch len(names) {
	case 0:
		return ""
	case 1:
		return names[0]
	case 2:
		return names[0] + " and " + names[1]
	}
	return names[0] + " and " + strconv.Itoa(len(names)-1) + " others"
}

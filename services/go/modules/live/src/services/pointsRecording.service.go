package services

import (
	"context"
	"nantty/modules/live/src/generated/ent/pointsentry"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/pointsrule"
)

type pointsContext struct {
	LiveId        uuid.UUID
	HostUserId    uuid.UUID
	CategoryId    string
	CountryCode   string
	HostIsCreator bool
}

type pointsAward struct {
	UserId         uuid.UUID
	Type           string
	Amount         int64
	SourceType     string
	SourceId       string
	IdempotencyKey string
}

func (service *LiveService) recordPointsInTransaction(ctx context.Context, tx *ent.Tx, scope pointsContext, awards ...pointsAward) error {
	for _, award := range awards {
		if award.Amount <= 0 {
			continue
		}
		err := tx.PointsEntry.Create().SetUserID(award.UserId).SetType(pointsentry.Type(award.Type)).SetAmount(award.Amount).
			SetSourceType(award.SourceType).SetSourceID(award.SourceId).SetLiveID(scope.LiveId).SetHostUserID(scope.HostUserId).
			SetCategoryID(scope.CategoryId).SetCountryCode(scope.CountryCode).SetHostIsCreator(scope.HostIsCreator).SetIdempotencyKey(award.IdempotencyKey).
			OnConflictColumns("idempotency_key").Ignore().Exec(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) readPointsPerCoin(ctx context.Context, tx *ent.Tx, ruleId string) (int64, error) {
	rule, err := tx.PointsRule.Query().Where(pointsrule.ID(ruleId), pointsrule.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return rule.Points, nil
}

func (service *LiveService) loadPointsContext(session *ent.LiveSession) pointsContext {
	return pointsContext{
		LiveId: session.ID, HostUserId: session.HostID, CategoryId: string(session.Category), CountryCode: session.CountryCode, HostIsCreator: session.HostIsCreator,
	}
}

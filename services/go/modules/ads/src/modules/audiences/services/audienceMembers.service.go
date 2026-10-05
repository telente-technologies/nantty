package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaudiencemember"
	"zudomart/modules/ads/src/generated/ent/adcustomaudience"
	"zudomart/modules/ads/src/modules/audiences/dtos"
)

const memberInsertChunk = 2000

func ResolveMembers(ctx context.Context, deployed *container.Container, account *ent.AdAccount, request dtos.CreateAudienceRequest) ([]string, error) {
	source := deployed.AudienceSource
	switch request.Type {
	case "store_customers":
		return source.StoreCustomers(ctx, account.StoreID, *request.RetentionDays, *request.MinimumOrders)
	case "engagers":
		return source.Engagers(ctx, account.OwnerUserID.String(), request.EngagementSource, *request.RetentionDays)
	}
	return source.Followers(ctx, account.OwnerUserID.String())
}

func StoreMembers(ctx context.Context, client *ent.Client, audienceId uuid.UUID, userIds []string) (int64, error) {
	unique := make(map[uuid.UUID]struct{}, len(userIds))
	for _, raw := range userIds {
		if parsed, err := uuid.Parse(raw); err == nil {
			unique[parsed] = struct{}{}
		}
	}
	creates := make([]*ent.AdAudienceMemberCreate, 0, memberInsertChunk)
	flush := func() error {
		if len(creates) == 0 {
			return nil
		}
		err := client.AdAudienceMember.CreateBulk(creates...).OnConflictColumns(adaudiencemember.FieldAudienceID, adaudiencemember.FieldUserID).DoNothing().Exec(ctx)
		creates = creates[:0]
		return err
	}
	for userId := range unique {
		creates = append(creates, client.AdAudienceMember.Create().SetAudienceID(audienceId).SetUserID(userId))
		if len(creates) == memberInsertChunk {
			if err := flush(); err != nil {
				return 0, err
			}
		}
	}
	return int64(len(unique)), flush()
}

func FinishBuilding(ctx context.Context, client *ent.Client, row *ent.AdCustomAudience, matched int64, buildError error) (*ent.AdCustomAudience, error) {
	update := row.Update()
	if buildError != nil {
		update.SetStatus(adcustomaudience.StatusFailed).SetDescription("Could not be built right now. Try again later.")
	} else {
		update.SetMatchedCount(matched).SetStatus(adcustomaudience.Status(StatusForMatchedCount(matched)))
	}
	return update.Save(ctx)
}

func AudienceIdsContaining(ctx context.Context, client *ent.Client, userId uuid.UUID) ([]string, error) {
	memberships, err := client.AdAudienceMember.Query().Where(adaudiencemember.UserID(userId)).Select(adaudiencemember.FieldAudienceID).Limit(500).All(ctx)
	if err != nil || len(memberships) == 0 {
		return nil, err
	}
	ids := make([]uuid.UUID, len(memberships))
	for index, membership := range memberships {
		ids[index] = membership.AudienceID
	}
	ready, err := client.AdCustomAudience.Query().Where(adcustomaudience.IDIn(ids...), adcustomaudience.StatusEQ(adcustomaudience.StatusReady)).IDs(ctx)
	result := make([]string, len(ready))
	for index, id := range ready {
		result[index] = id.String()
	}
	return result, err
}

func LoadAudienceInAccount(ctx context.Context, client *ent.Client, accountId, audienceId uuid.UUID) (*ent.AdCustomAudience, error) {
	row, err := client.AdCustomAudience.Query().Where(adcustomaudience.ID(audienceId), adcustomaudience.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errAudienceNotFound
	}
	return row, err
}

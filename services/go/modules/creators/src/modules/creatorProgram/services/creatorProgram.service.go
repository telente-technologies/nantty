package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"zudomart/modules/creators/src/container"
	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/creatorprogrammember"
	"zudomart/modules/creators/src/generated/ent/creatortier"
	"zudomart/modules/creators/src/modules/creatorProgram/dtos"
	"zudomart/modules/creators/src/modules/liveMoney/models"
	"zudomart/modules/ledger/src/databases"
	"zudomart/platform/httpserver"
)

var (
	ErrRecipientCannotReceiveGifts = errors.New("RECIPIENT_CANNOT_RECEIVE_GIFTS")
	ErrCreatorTierNotFound         = httpserver.NewApiError(http.StatusNotFound, "CREATOR_TIER_NOT_FOUND", "Creator tier was not found.")
)

var defaultCreatorTiers = []struct {
	id, name string
	bps      int64
}{{"starter", "Starter", 5000}, {"partner", "Partner", 6000}, {"top", "Top creator", 7000}}

type CreatorProgram struct {
	Container *container.Container
}

func (program CreatorProgram) SeedDefaultTiersWhenMissing(ctx context.Context) error {
	client := program.Container.Client(program.Container.Resources.Database)
	for _, tier := range defaultCreatorTiers {
		err := client.CreatorTier.Create().SetID(tier.id).SetName(tier.name).SetGiftShareBps(tier.bps).SetIsDefault(tier.id == program.Container.Settings.DefaultTierId).
			OnConflictColumns(creatortier.FieldID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return nil
}

func (program CreatorProgram) giftShareForApprovedMember(ctx context.Context, executor databases.ExecutorQuerier, client *ent.Client, userId string) (int64, bool, error) {
	member, err := client.CreatorProgramMember.Query().Where(creatorprogrammember.UserID(userId), creatorprogrammember.StatusEQ(creatorprogrammember.StatusApproved)).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	tier, err := client.CreatorTier.Get(ctx, member.TierID)
	if err != nil {
		return 0, false, err
	}
	share, err := program.applyAdminGiftShareTiers(ctx, executor, userId, tier.GiftShareBps)
	return min(share, models.MaximumCreatorGiftShareBps), true, err
}

func (program CreatorProgram) ResolveCreditedCreator(ctx context.Context, executor databases.ExecutorQuerier, receiverUserId, hostUserId string) (string, int64, error) {
	client := program.Container.Client(executor)
	share, approved, err := program.giftShareForApprovedMember(ctx, executor, client, receiverUserId)
	if err != nil || approved {
		return receiverUserId, share, err
	}
	share, approved, err = program.giftShareForApprovedMember(ctx, executor, client, hostUserId)
	if err != nil {
		return "", 0, err
	}
	if !approved {
		return "", 0, ErrRecipientCannotReceiveGifts
	}
	return hostUserId, share, nil
}

func (program CreatorProgram) CreditableUserResolver(ctx context.Context, executor databases.ExecutorQuerier, hostUserId string) func(string) (string, error) {
	return func(userId string) (string, error) {
		credited, _, err := program.ResolveCreditedCreator(ctx, executor, userId, hostUserId)
		return credited, err
	}
}

func (program CreatorProgram) EnrollApprovedCreatorInDefaultTier(ctx context.Context, userId string) error {
	if strings.TrimSpace(userId) == "" {
		return nil
	}
	client := program.Container.Client(program.Container.Resources.Database)
	return client.CreatorProgramMember.Create().SetUserID(userId).SetTierID(program.Container.Settings.DefaultTierId).SetStatus(creatorprogrammember.StatusApproved).
		SetCreatedAt(program.Container.Now().UTC()).OnConflictColumns(creatorprogrammember.FieldUserID).DoNothing().Exec(ctx)
}

func (program CreatorProgram) ListCreatorTiers(ctx context.Context) ([]dtos.CreatorTierDto, error) {
	tiers, err := program.Container.Client(program.Container.Resources.Database).CreatorTier.Query().Order(ent.Asc(creatortier.FieldGiftShareBps)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]dtos.CreatorTierDto, len(tiers))
	for index, tier := range tiers {
		converted[index] = dtos.CreatorTierDto{Id: tier.ID, Name: tier.Name, GiftShareBps: tier.GiftShareBps, IsDefault: tier.IsDefault}
	}
	return converted, nil
}

func (program CreatorProgram) UpdateCreatorTierShare(ctx context.Context, staffId, tierId string, giftShareBps int64) (dtos.CreatorTierDto, error) {
	tier, err := program.Container.Client(program.Container.Resources.Database).CreatorTier.UpdateOneID(tierId).
		SetGiftShareBps(giftShareBps).SetUpdatedByStaffID(staffId).Save(ctx)
	if ent.IsNotFound(err) {
		return dtos.CreatorTierDto{}, ErrCreatorTierNotFound
	}
	if err != nil {
		return dtos.CreatorTierDto{}, err
	}
	return dtos.CreatorTierDto{Id: tier.ID, Name: tier.Name, GiftShareBps: tier.GiftShareBps, IsDefault: tier.IsDefault}, nil
}

func (program CreatorProgram) ApprovedCreatorShare(ctx context.Context, executor databases.ExecutorQuerier, userId string) (int64, bool, error) {
	return program.giftShareForApprovedMember(ctx, executor, program.Container.Client(executor), userId)
}

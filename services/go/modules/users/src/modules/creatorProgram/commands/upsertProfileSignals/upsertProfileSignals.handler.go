package upsertprofilesignals

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilesignal"
	businessservices "nantty/modules/users/src/modules/businessDocuments/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := handler.Container.Client.Profile.Query().Where(profile.ID(command.ProfileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return usersErrors.NotFound("That profile was not found.")
	}
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.ProfileSignal.Query().Where(profilesignal.ProfileID(owner.ID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			create := tx.ProfileSignal.Create().SetProfileID(owner.ID).SetAccountID(owner.AccountID)
			applyToCreate(create, command)
			err = create.Exec(ctx)
		} else if err == nil {
			update := existing.Update()
			applyToUpdate(update, command)
			err = update.Exec(ctx)
		}
		if err != nil || command.Input.SellerPlan == nil || *command.Input.SellerPlan == "FREE" || owner.Kind != profile.KindBusiness {
			return err
		}
		return businessservices.EvaluateGoldFromApprovedDocuments(ctx, handler.Container, tx, owner.AccountID)
	})
}

func applyToCreate(builder *ent.ProfileSignalCreate, command Command) {
	input := command.Input
	setIf(input.RealFollowers, builder.SetRealFollowers)
	setIf(input.OriginalPostsLast60Days, builder.SetOriginalPostsLast60Days)
	setIf(input.DaysSinceLastViolation, builder.SetDaysSinceLastViolation)
	setIf(input.FraudScore, builder.SetFraudScore)
	setIf(input.RiskScore, builder.SetRiskScore)
	setIf(input.IdVerified, builder.SetIDVerified)
	setIf(input.BorderlineContent, builder.SetBorderlineContent)
	setIf(input.CompletedOrders, builder.SetCompletedOrders)
	setIf(input.SuccessRatePercent, builder.SetSuccessRatePercent)
	setIf(input.HasActiveStoreOrBrandPage, builder.SetHasActiveStoreOrBrandPage)
	if input.SellerPlan != nil {
		builder.SetSellerPlan(profilesignal.SellerPlan(*input.SellerPlan))
	}
	builder.SetSource(input.Source)
}

func applyToUpdate(builder *ent.ProfileSignalUpdateOne, command Command) {
	input := command.Input
	setIf(input.RealFollowers, builder.SetRealFollowers)
	setIf(input.OriginalPostsLast60Days, builder.SetOriginalPostsLast60Days)
	setIf(input.DaysSinceLastViolation, builder.SetDaysSinceLastViolation)
	setIf(input.FraudScore, builder.SetFraudScore)
	setIf(input.RiskScore, builder.SetRiskScore)
	setIf(input.IdVerified, builder.SetIDVerified)
	setIf(input.BorderlineContent, builder.SetBorderlineContent)
	setIf(input.CompletedOrders, builder.SetCompletedOrders)
	setIf(input.SuccessRatePercent, builder.SetSuccessRatePercent)
	setIf(input.HasActiveStoreOrBrandPage, builder.SetHasActiveStoreOrBrandPage)
	if input.SellerPlan != nil {
		builder.SetSellerPlan(profilesignal.SellerPlan(*input.SellerPlan))
	}
	builder.SetSource(input.Source)
}

func setIf[Value any, Builder any](value *Value, setter func(Value) Builder) {
	if value != nil {
		setter(*value)
	}
}

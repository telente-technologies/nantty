package upsertprofilesignals

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilesignal"
	businessservices "nantty/modules/users/src/modules/businessDocuments/services"
	"nantty/modules/users/src/modules/creatorProgram/dtos"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	metricsProvided := command.Input.VerifiedFollowers != nil || command.Input.QualifyingImpressions30d != nil || command.Input.CreatorMetricsAsOf != nil || command.Input.CreatorMetricsSnapshotId != ""
	if metricsProvided && (command.Input.RealFollowers == nil || command.Input.VerifiedFollowers == nil || command.Input.QualifyingImpressions30d == nil || command.Input.OriginalPostsLast60Days == nil || command.Input.CreatorMetricsAsOf == nil || command.Input.CreatorMetricsSnapshotId == "" || command.Input.Source != "analytics_creator_eligibility_v1") {
		return usersErrors.Unprocessable("Creator eligibility metrics require a complete snapshot from the trusted analytics source")
	}
	if metricsProvided && (command.Input.RealFollowers != nil && *command.Input.RealFollowers < 0 || command.Input.VerifiedFollowers != nil && *command.Input.VerifiedFollowers < 0 || command.Input.QualifyingImpressions30d != nil && *command.Input.QualifyingImpressions30d < 0 || command.Input.OriginalPostsLast60Days != nil && *command.Input.OriginalPostsLast60Days < 0) {
		return usersErrors.Unprocessable("Creator eligibility metrics cannot be negative")
	}
	if metricsProvided && command.Input.CreatorMetricsAsOf.After(handler.Container.Now().Add(5*time.Minute)) {
		return usersErrors.Unprocessable("Creator eligibility snapshot time cannot be in the future")
	}
	var metricsSnapshotID uuid.UUID
	if metricsProvided {
		var err error
		metricsSnapshotID, err = uuid.Parse(command.Input.CreatorMetricsSnapshotId)
		if err != nil {
			return usersErrors.Unprocessable("Creator eligibility snapshot identifier must be a UUID")
		}
	}
	standingProvided := command.Input.DaysSinceLastViolation != nil
	if standingProvided && (command.Input.CreatorStandingSource != "moderation_creator_standing_v1" || command.Input.CreatorStandingSnapshotId == "" || command.Input.CreatorStandingAsOf == nil) {
		return usersErrors.Unprocessable("Creator policy standing requires a complete moderation snapshot")
	}
	if standingProvided && (*command.Input.DaysSinceLastViolation < 0 || command.Input.CreatorStandingAsOf.After(handler.Container.Now().Add(5*time.Minute))) {
		return usersErrors.Unprocessable("Creator policy standing snapshot is invalid")
	}
	var standingSnapshotID uuid.UUID
	if standingProvided {
		var err error
		standingSnapshotID, err = uuid.Parse(command.Input.CreatorStandingSnapshotId)
		if err != nil {
			return usersErrors.Unprocessable("Creator policy standing snapshot identifier must be a UUID")
		}
	}
	owner, err := handler.Container.Client.Profile.Query().Where(profile.ID(command.ProfileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return usersErrors.NotFound("That profile was not found.")
	}
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", owner.ID.String()); err != nil {
			return err
		}
		if metricsProvided {
			if err := recordCreatorMetricsSnapshot(ctx, tx, owner.ID, owner.AccountID, command.Input); err != nil {
				return err
			}
		}
		if standingProvided {
			if err := recordCreatorStandingSnapshot(ctx, tx, owner.ID, owner.AccountID, command.Input); err != nil {
				return err
			}
		}
		existing, err := tx.ProfileSignal.Query().Where(profilesignal.ProfileID(owner.ID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			create := tx.ProfileSignal.Create().SetProfileID(owner.ID).SetAccountID(owner.AccountID)
			applyToCreate(create, command)
			if metricsProvided {
				create.SetCreatorRealFollowers(*command.Input.RealFollowers).SetVerifiedFollowers(*command.Input.VerifiedFollowers).SetQualifyingImpressionsLast30Days(*command.Input.QualifyingImpressions30d).SetCreatorOriginalPostsLast60Days(*command.Input.OriginalPostsLast60Days).SetCreatorMetricsSource(command.Input.Source).SetCreatorMetricsAsOf(*command.Input.CreatorMetricsAsOf).SetCreatorMetricsSnapshotID(metricsSnapshotID)
			}
			if standingProvided {
				create.SetCreatorDaysSinceLastViolation(*command.Input.DaysSinceLastViolation).SetCreatorStandingAvailable(true).SetCreatorStandingSource(command.Input.CreatorStandingSource).SetCreatorStandingAsOf(*command.Input.CreatorStandingAsOf).SetCreatorStandingSnapshotID(standingSnapshotID)
			}
			err = create.Exec(ctx)
		} else if err == nil {
			applyMetrics := metricsProvided
			if metricsProvided && existing.CreatorMetricsAsOf != nil {
				if command.Input.CreatorMetricsAsOf.Before(*existing.CreatorMetricsAsOf) {
					return usersErrors.Conflict("CREATOR_METRICS_SNAPSHOT_STALE", "Creator eligibility metric snapshots must be newer than the current snapshot")
				}
				if command.Input.CreatorMetricsAsOf.Equal(*existing.CreatorMetricsAsOf) {
					sameSnapshot := existing.CreatorMetricsSnapshotID != nil && existing.CreatorMetricsSnapshotID.String() == command.Input.CreatorMetricsSnapshotId && existing.CreatorRealFollowers == *command.Input.RealFollowers && existing.VerifiedFollowers == *command.Input.VerifiedFollowers && existing.QualifyingImpressionsLast30Days == *command.Input.QualifyingImpressions30d && existing.CreatorOriginalPostsLast60Days == *command.Input.OriginalPostsLast60Days
					if !sameSnapshot {
						return usersErrors.Conflict("CREATOR_METRICS_SNAPSHOT_CONFLICT", "Creator eligibility metric snapshots must be newer than the current snapshot")
					}
					applyMetrics = false
				}
			}
			applyStanding := standingProvided
			if standingProvided && existing.CreatorStandingAsOf != nil {
				if command.Input.CreatorStandingAsOf.Before(*existing.CreatorStandingAsOf) {
					return usersErrors.Conflict("CREATOR_STANDING_SNAPSHOT_STALE", "Creator policy standing snapshots must be newer than the current snapshot")
				}
				if command.Input.CreatorStandingAsOf.Equal(*existing.CreatorStandingAsOf) {
					sameSnapshot := existing.CreatorDaysSinceLastViolation == *command.Input.DaysSinceLastViolation && existing.CreatorStandingSnapshotID != nil && existing.CreatorStandingSnapshotID.String() == command.Input.CreatorStandingSnapshotId
					if !sameSnapshot {
						return usersErrors.Conflict("CREATOR_STANDING_SNAPSHOT_CONFLICT", "Creator policy standing snapshots must be newer than the current snapshot")
					}
					applyStanding = false
				}
			}
			update := existing.Update()
			applyToUpdate(update, command)
			if applyMetrics {
				update.SetCreatorRealFollowers(*command.Input.RealFollowers).SetVerifiedFollowers(*command.Input.VerifiedFollowers).SetQualifyingImpressionsLast30Days(*command.Input.QualifyingImpressions30d).SetCreatorOriginalPostsLast60Days(*command.Input.OriginalPostsLast60Days).SetCreatorMetricsSource(command.Input.Source).SetCreatorMetricsAsOf(*command.Input.CreatorMetricsAsOf).SetCreatorMetricsSnapshotID(metricsSnapshotID)
			}
			if applyStanding {
				update.SetCreatorDaysSinceLastViolation(*command.Input.DaysSinceLastViolation).SetCreatorStandingAvailable(true).SetCreatorStandingSource(command.Input.CreatorStandingSource).SetCreatorStandingAsOf(*command.Input.CreatorStandingAsOf).SetCreatorStandingSnapshotID(standingSnapshotID)
			}
			err = update.Exec(ctx)
		}
		if err != nil || command.Input.SellerPlan == nil || *command.Input.SellerPlan == "FREE" || owner.Kind != profile.KindBusiness {
			return err
		}
		return businessservices.EvaluateGoldFromApprovedDocuments(ctx, handler.Container, tx, owner.AccountID)
	})
}

func recordCreatorStandingSnapshot(ctx context.Context, tx *ent.Tx, profileId, accountId uuid.UUID, input dtos.ProfileSignalsRequest) error {
	snapshotId, err := uuid.Parse(input.CreatorStandingSnapshotId)
	if err != nil {
		return usersErrors.Unprocessable("Creator policy standing snapshot identifier must be a UUID")
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO creator_policy_standing_snapshots (snapshot_id, profile_id, account_id, source, standing_as_of, days_since_last_violation) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (snapshot_id) DO NOTHING`, snapshotId, profileId, accountId, input.CreatorStandingSource, *input.CreatorStandingAsOf, *input.DaysSinceLastViolation)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 1 {
		return nil
	}
	matches, err := snapshotMatches(ctx, tx, `SELECT profile_id = $2 AND account_id = $3 AND source = $4 AND standing_as_of = $5 AND days_since_last_violation = $6 FROM creator_policy_standing_snapshots WHERE snapshot_id = $1`, snapshotId, profileId, accountId, input.CreatorStandingSource, *input.CreatorStandingAsOf, *input.DaysSinceLastViolation)
	if err != nil {
		return err
	}
	if !matches {
		return usersErrors.Conflict("CREATOR_STANDING_SNAPSHOT_ID_REUSED", "Creator policy standing snapshot identifier was already used for different data")
	}
	return nil
}

func recordCreatorMetricsSnapshot(ctx context.Context, tx *ent.Tx, profileId, accountId uuid.UUID, input dtos.ProfileSignalsRequest) error {
	snapshotId, err := uuid.Parse(input.CreatorMetricsSnapshotId)
	if err != nil {
		return usersErrors.Unprocessable("Creator eligibility snapshot identifier must be a UUID")
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO creator_eligibility_metric_snapshots (snapshot_id, profile_id, account_id, source, metrics_as_of, real_followers, verified_followers, qualifying_impressions_last_30_days, original_posts_last_60_days) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (snapshot_id) DO NOTHING`, snapshotId, profileId, accountId, input.Source, *input.CreatorMetricsAsOf, *input.RealFollowers, *input.VerifiedFollowers, *input.QualifyingImpressions30d, *input.OriginalPostsLast60Days)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 1 {
		return nil
	}
	matches, err := snapshotMatches(ctx, tx, `SELECT profile_id = $2 AND account_id = $3 AND source = $4 AND metrics_as_of = $5 AND real_followers = $6 AND verified_followers = $7 AND qualifying_impressions_last_30_days = $8 AND original_posts_last_60_days = $9 FROM creator_eligibility_metric_snapshots WHERE snapshot_id = $1`, snapshotId, profileId, accountId, input.Source, *input.CreatorMetricsAsOf, *input.RealFollowers, *input.VerifiedFollowers, *input.QualifyingImpressions30d, *input.OriginalPostsLast60Days)
	if err != nil {
		return err
	}
	if !matches {
		return usersErrors.Conflict("CREATOR_METRICS_SNAPSHOT_ID_REUSED", "Creator eligibility snapshot identifier was already used for different data")
	}
	return nil
}

func snapshotMatches(ctx context.Context, tx *ent.Tx, query string, args ...any) (bool, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	if !rows.Next() {
		return false, rows.Err()
	}
	var matches bool
	if err := rows.Scan(&matches); err != nil {
		return false, err
	}
	return matches, rows.Err()
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

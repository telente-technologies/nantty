package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/shippingdestination"
	"zudomart/modules/orders/src/generated/ent/shippingrule"
	"zudomart/modules/orders/src/generated/ent/shippingzone"
	"zudomart/platform/commerceports"
)

type DestinationInput struct {
	CountryCode string
	StateCode   *string
	LgaName     *string
	RegionId    *uuid.UUID
	AdminAreaId *uuid.UUID
}

type RuleInput struct {
	ZoneName     *string
	Destinations *[]DestinationInput
	IsFree       *bool
	FeeMinor     *int64
	Active       *bool
}

type resolvedDestination struct {
	CountryCode string
	RegionId    *uuid.UUID
	AdminAreaId *uuid.UUID
}

func resolveDestinations(ctx context.Context, deployed *container.Container, inputs []DestinationInput) ([]resolvedDestination, error) {
	resolved := make([]resolvedDestination, 0, len(inputs))
	for _, input := range inputs {
		country := strings.ToUpper(input.CountryCode)
		destination := resolvedDestination{CountryCode: country, RegionId: input.RegionId, AdminAreaId: input.AdminAreaId}
		if input.StateCode != nil {
			region, found, err := deployed.Users.FindRegionByCode(ctx, country, *input.StateCode)
			if err != nil || !found {
				return nil, firstFailure(err, ordererrors.DestinationInvalid)
			}
			destination.RegionId = &region.Id
		}
		if input.LgaName != nil {
			if destination.RegionId == nil {
				return nil, ordererrors.DestinationInvalid
			}
			areaId, found, err := deployed.Users.FindAdminAreaIdByName(ctx, *destination.RegionId, *input.LgaName)
			if err != nil || !found {
				return nil, firstFailure(err, ordererrors.DestinationInvalid)
			}
			destination.AdminAreaId = &areaId
		}
		if err := verifyGeoConsistency(ctx, deployed, destination); err != nil {
			return nil, err
		}
		resolved = append(resolved, destination)
	}
	return resolved, nil
}

func verifyGeoConsistency(ctx context.Context, deployed *container.Container, destination resolvedDestination) error {
	if destination.AdminAreaId != nil && destination.RegionId == nil {
		return ordererrors.DestinationInvalid
	}
	if destination.RegionId != nil {
		valid, err := deployed.Users.RegionBelongsToCountry(ctx, *destination.RegionId, destination.CountryCode)
		if err != nil || !valid {
			return firstFailure(err, ordererrors.DestinationInvalid)
		}
	}
	if destination.AdminAreaId != nil {
		valid, err := deployed.Users.AdminAreaBelongsToRegion(ctx, *destination.AdminAreaId, *destination.RegionId)
		if err != nil || !valid {
			return firstFailure(err, ordererrors.DestinationInvalid)
		}
	}
	return nil
}

func SaveShippingRule(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, ruleId *uuid.UUID, input RuleInput) (uuid.UUID, error) {
	profile, err := EnsureDefaultShippingProfile(ctx, deployed, store)
	if err != nil {
		return uuid.Nil, err
	}
	var destinations []resolvedDestination
	if input.Destinations != nil {
		if destinations, err = resolveDestinations(ctx, deployed, *input.Destinations); err != nil {
			return uuid.Nil, err
		}
	}
	var savedRule uuid.UUID
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if ruleId == nil {
			var createError error
			savedRule, createError = createRuleWithZone(ctx, deployed, tx, profile, input, destinations)
			return createError
		}
		savedRule = *ruleId
		return updateRuleAndZone(ctx, tx, profile, *ruleId, input, destinations, input.Destinations != nil)
	})
	return savedRule, err
}

func createRuleWithZone(ctx context.Context, deployed *container.Container, tx *ent.Tx, profile *ent.ShippingProfile, input RuleInput, destinations []resolvedDestination) (uuid.UUID, error) {
	zones, err := tx.ShippingZone.Query().Where(shippingzone.ProfileID(profile.ID)).Count(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	if zones >= deployed.Settings.ShippingRuleLimit {
		return uuid.Nil, ordererrors.RuleLimitReached
	}
	zone, err := tx.ShippingZone.Create().SetProfileID(profile.ID).SetName(strings.TrimSpace(*input.ZoneName)).Save(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	if err := writeDestinations(ctx, tx, zone.ID, destinations); err != nil {
		return uuid.Nil, err
	}
	create := tx.ShippingRule.Create().SetZoneID(zone.ID).SetIsFree(input.IsFree != nil && *input.IsFree).SetActive(input.Active == nil || *input.Active)
	if input.FeeMinor != nil && (input.IsFree == nil || !*input.IsFree) {
		create.SetFeeMinor(*input.FeeMinor)
	}
	rule, err := create.Save(ctx)
	return rule.ID, err
}

func updateRuleAndZone(ctx context.Context, tx *ent.Tx, profile *ent.ShippingProfile, ruleId uuid.UUID, input RuleInput, destinations []resolvedDestination, replaceDestinations bool) error {
	rule, err := tx.ShippingRule.Get(ctx, ruleId)
	if ent.IsNotFound(err) {
		return ordererrors.RuleNotFound
	}
	if err != nil {
		return err
	}
	zone, err := tx.ShippingZone.Query().Where(shippingzone.ID(rule.ZoneID), shippingzone.ProfileID(profile.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return ordererrors.RuleNotFound
	}
	if err != nil {
		return err
	}
	if input.ZoneName != nil {
		if err := zone.Update().SetName(strings.TrimSpace(*input.ZoneName)).Exec(ctx); err != nil {
			return err
		}
	}
	if replaceDestinations {
		if _, err := tx.ShippingDestination.Delete().Where(shippingdestination.ZoneID(zone.ID)).Exec(ctx); err != nil {
			return err
		}
		if err := writeDestinations(ctx, tx, zone.ID, destinations); err != nil {
			return err
		}
	}
	update := rule.Update()
	if input.IsFree != nil {
		update.SetIsFree(*input.IsFree)
		if *input.IsFree {
			update.SetFeeMinor(0)
		}
	}
	if input.FeeMinor != nil && (input.IsFree == nil || !*input.IsFree) {
		update.SetFeeMinor(*input.FeeMinor)
	}
	if input.Active != nil {
		update.SetActive(*input.Active)
	}
	return update.Exec(ctx)
}

func writeDestinations(ctx context.Context, tx *ent.Tx, zoneId uuid.UUID, destinations []resolvedDestination) error {
	for _, destination := range destinations {
		if err := tx.ShippingDestination.Create().SetZoneID(zoneId).SetCountryCode(destination.CountryCode).SetNillableRegionID(destination.RegionId).SetNillableAdminAreaID(destination.AdminAreaId).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func DeleteShippingRule(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, ruleId uuid.UUID) error {
	profile, err := EnsureDefaultShippingProfile(ctx, deployed, store)
	if err != nil {
		return err
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		rule, err := tx.ShippingRule.Query().Where(shippingrule.ID(ruleId)).Only(ctx)
		if ent.IsNotFound(err) {
			return ordererrors.RuleNotFound
		}
		if err != nil {
			return err
		}
		owned, err := tx.ShippingZone.Query().Where(shippingzone.ID(rule.ZoneID), shippingzone.ProfileID(profile.ID)).Exist(ctx)
		if err != nil || !owned {
			return firstFailure(err, ordererrors.RuleNotFound)
		}
		if _, err := tx.ShippingDestination.Delete().Where(shippingdestination.ZoneID(rule.ZoneID)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.ShippingRule.DeleteOne(rule).Exec(ctx); err != nil {
			return err
		}
		return tx.ShippingZone.DeleteOneID(rule.ZoneID).Exec(ctx)
	})
}

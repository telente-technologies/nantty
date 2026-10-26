package services

import (
	"context"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/retentionpolicy"
	"nantty/modules/users/src/modules/retention/models"
)

func SeedDefaultRetentionPoliciesIfMissing(ctx context.Context, client *ent.Client) error {
	for _, category := range models.Categories {
		exists, err := client.RetentionPolicy.Query().Where(retentionpolicy.CategoryEQ(retentionpolicy.Category(category))).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		err = client.RetentionPolicy.Create().SetCategory(retentionpolicy.Category(category)).SetAction(retentionpolicy.ActionRetain).SetNeedsLegalReview(true).Exec(ctx)
		if err != nil && !ent.IsConstraintError(err) {
			return err
		}
	}
	return nil
}

func LoadRetentionPolicies(ctx context.Context, client *ent.Client) ([]*ent.RetentionPolicy, error) {
	rows, err := client.RetentionPolicy.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	byCategory := map[string]*ent.RetentionPolicy{}
	for _, row := range rows {
		byCategory[string(row.Category)] = row
	}
	ordered := make([]*ent.RetentionPolicy, 0, len(rows))
	for _, category := range models.Categories {
		if row := byCategory[category]; row != nil {
			ordered = append(ordered, row)
		}
	}
	return ordered, nil
}

func SnapshotOf(rows []*ent.RetentionPolicy) []models.PolicySnapshot {
	snapshot := make([]models.PolicySnapshot, 0, len(rows))
	for _, row := range rows {
		snapshot = append(snapshot, models.PolicySnapshot{Category: string(row.Category), Action: string(row.Action), RetentionDays: row.RetentionDays, NeedsLegalReview: row.NeedsLegalReview})
	}
	return snapshot
}

func ActionFor(rows []*ent.RetentionPolicy, category string) (action string, retentionDays *int) {
	for _, row := range rows {
		if string(row.Category) == category {
			return string(row.Action), row.RetentionDays
		}
	}
	return string(retentionpolicy.ActionRetain), nil
}

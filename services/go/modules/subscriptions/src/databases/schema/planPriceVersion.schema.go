package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// PlanPriceVersion is an append-only, effective-dated snapshot of a regional
// subscription price. A later price change creates another row; it never edits
// an existing version.
type PlanPriceVersion struct {
	ent.Schema
}

func (PlanPriceVersion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PlanPriceVersion) Fields() []ent.Field {
	return []ent.Field{
		field.String("plan_code").NotEmpty().MaxLen(40).Immutable(),
		field.String("country_code").NotEmpty().MaxLen(2).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("monthly_amount_minor").Immutable(),
		field.Int64("yearly_amount_minor").Default(0).Immutable(),
		field.Int64("ios_monthly_amount_minor").Default(0).Immutable(),
		field.Int64("ios_yearly_amount_minor").Default(0).Immutable(),
		field.Int64("android_monthly_amount_minor").Default(0).Immutable(),
		field.Int64("android_yearly_amount_minor").Default(0).Immutable(),
		field.JSON("store_product_ids", map[string]string{}).Default(map[string]string{}).Immutable(),
		field.Bool("active").Default(true).Immutable(),
		field.Time("effective_from").Immutable(),
		field.String("created_by_staff_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("change_reason").NotEmpty().MaxLen(300).Immutable(),
	}
}

func (PlanPriceVersion) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("plan_code", "country_code", "effective_from").Unique(),
		index.Fields("effective_from"),
	}
}

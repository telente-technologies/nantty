package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GeoCountry struct {
	ent.Schema
}

func (GeoCountry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GeoCountry) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").NotEmpty().MaxLen(2).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("region_label").Optional().Nillable().MaxLen(40),
		field.String("admin_area_label").Optional().Nillable().MaxLen(40),
		field.Bool("postal_code_required").Default(false),
	}
}

func (GeoCountry) Indexes() []ent.Index {
	return []ent.Index{index.Fields("code").Unique()}
}

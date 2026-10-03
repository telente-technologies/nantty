package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GeoRegion struct {
	ent.Schema
}

func (GeoRegion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GeoRegion) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("country_id", uuid.UUID{}).Immutable(),
		field.String("country_code").NotEmpty().MaxLen(2).Immutable(),
		field.String("code").Optional().Nillable().MaxLen(10),
		field.String("name").NotEmpty().MaxLen(80),
	}
}

func (GeoRegion) Indexes() []ent.Index {
	return []ent.Index{index.Fields("country_code", "name").Unique(), index.Fields("country_id")}
}

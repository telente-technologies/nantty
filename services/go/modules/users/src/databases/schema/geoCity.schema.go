package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GeoCity struct {
	ent.Schema
}

func (GeoCity) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GeoCity) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("region_id", uuid.UUID{}).Immutable(),
		field.UUID("admin_area_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
	}
}

func (GeoCity) Indexes() []ent.Index {
	return []ent.Index{index.Fields("region_id", "name").Unique(), index.Fields("admin_area_id")}
}

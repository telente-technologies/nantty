package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GeoAdminArea struct {
	ent.Schema
}

func (GeoAdminArea) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GeoAdminArea) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("region_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
	}
}

func (GeoAdminArea) Indexes() []ent.Index {
	return []ent.Index{index.Fields("region_id", "name").Unique()}
}

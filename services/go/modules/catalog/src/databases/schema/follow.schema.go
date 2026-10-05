package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CatalogFollow struct {
	ent.Schema
}

func (CatalogFollow) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CatalogFollow) Fields() []ent.Field {
	return []ent.Field{
		field.String("target_kind").NotEmpty().MaxLen(10).Immutable(),
		field.UUID("target_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
	}
}

func (CatalogFollow) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("target_kind", "target_id", "account_id").Unique(),
		index.Fields("account_id", "target_kind", "id").Annotations(entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}),
	}
}

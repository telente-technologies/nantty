package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StoreAuditEntry struct {
	ent.Schema
}

func (StoreAuditEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreAuditEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("actor_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("actor_name").Default("").MaxLen(80).Immutable(),
		field.String("actor_role").Default("").MaxLen(20).Immutable(),
		field.String("action").NotEmpty().MaxLen(60).Immutable(),
		field.String("target_type").Default("").MaxLen(40).Immutable(),
		field.String("target_id").Optional().Nillable().MaxLen(80).Immutable(),
		field.String("summary").Default("").MaxLen(300).Immutable(),
		field.String("ip_address").Optional().Nillable().MaxLen(64).Immutable(),
	}
}

func (StoreAuditEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "id").Annotations(entsql.DescColumns("id")).StorageKey("storeauditentry_store_newest"),
		index.Fields("store_id", "actor_id", "id"),
	}
}

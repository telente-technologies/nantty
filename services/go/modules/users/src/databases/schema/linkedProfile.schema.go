package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LinkedProfile struct {
	ent.Schema
}

func (LinkedProfile) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LinkedProfile) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}),
		field.Enum("kind").Values("store", "business", "brand"),
		field.UUID("profile_id", uuid.UUID{}),
		field.UUID("store_id", uuid.UUID{}).Optional().Nillable(),
		field.Enum("status").Values("active", "held", "retired").Default("active"),
		field.String("hold_reason").Optional().Nillable().MaxLen(300),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LinkedProfile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("kind", "profile_id").Unique(),
		index.Fields("account_id").StorageKey("linked_profile_one_store_per_account").Unique().Annotations(entsql.IndexWhere("status = 'active' AND (kind = 'store' OR store_id IS NOT NULL)")),
		index.Fields("account_id", "status"),
	}
}

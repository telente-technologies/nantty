package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StoreSuccessStat struct {
	ent.Schema
}

func (StoreSuccessStat) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreSuccessStat) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}),
		field.Int("settled_orders").Default(0),
		field.Int("successful_orders").Default(0),
		field.Time("computed_at").Default(time.Now),
	}
}

func (StoreSuccessStat) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id").Unique()}
}

package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LiveProduct struct {
	ent.Schema
}

func (LiveProduct) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveProduct) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.Bool("pinned").Default(false),
		field.Time("pinned_at").Optional().Nillable().Default(time.Now),
		field.String("title").Optional().Nillable().MaxLen(200),
		field.Int64("price_minor").Optional().Nillable(),
		field.String("currency").Optional().Nillable().MaxLen(3),
		field.String("image_url").Optional().Nillable().MaxLen(500),
	}
}

func (LiveProduct) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "product_id").Unique()}
}

type LiveViewer struct {
	ent.Schema
}

func (LiveViewer) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveViewer) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Time("last_seen_at").Default(time.Now),
		field.Time("left_at").Optional().Nillable(),
	}
}

func (LiveViewer) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "user_id").Unique(), index.Fields("live_id", "left_at")}
}

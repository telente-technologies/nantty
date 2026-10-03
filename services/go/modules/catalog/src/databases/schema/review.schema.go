package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Review struct {
	ent.Schema
}

func (Review) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Review) Fields() []ent.Field {
	return []ent.Field{
		field.String("kind").NotEmpty().Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("author_account_id", uuid.UUID{}).Immutable(),
		field.String("order_number").Optional().Nillable().MaxLen(40).Immutable(),
		field.Bool("verified_purchase").Default(false).Immutable(),
		field.Int("rating").Min(1).Max(5),
		field.String("title").Optional().Nillable().MaxLen(120),
		field.String("body").NotEmpty().MaxLen(2000),
		field.Int("photo_count").Default(0),
		field.Int("helpful_count").Default(0),
		field.String("status").Default("published"),
		field.String("report_reason").Optional().Nillable().MaxLen(40),
		field.String("report_details").Optional().Nillable().MaxLen(500),
		field.String("reply_body").Optional().Nillable().MaxLen(1000),
		field.String("reply_author_name").Optional().Nillable().MaxLen(80),
		field.Time("reply_created_at").Optional().Nillable(),
		field.Time("reply_updated_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Review) Indexes() []ent.Index {
	newest := entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}
	return []ent.Index{
		index.Fields("product_id", "id").Annotations(newest).StorageKey("review_product_newest"),
		index.Fields("store_id", "kind", "id").Annotations(newest).StorageKey("review_store_newest"),
		index.Fields("author_account_id", "product_id").Unique().Annotations(entsql.IndexAnnotation{Where: "product_id IS NOT NULL"}).StorageKey("review_author_product_unique"),
		index.Fields("author_account_id", "store_id").Unique().Annotations(entsql.IndexAnnotation{Where: "kind = 'store'"}).StorageKey("review_author_store_unique"),
	}
}

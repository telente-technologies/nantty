package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockLocation struct {
	ent.Schema
}

func (StockLocation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockLocation) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("kind").Default("warehouse"),
		field.String("address").Default("").MaxLen(200),
		field.String("city").Default("").MaxLen(60),
		field.String("state").Default("").MaxLen(60),
		field.String("country_code").Default("").MaxLen(2),
		field.String("phone").Optional().Nillable().MaxLen(20),
		field.Bool("is_default").Default(false),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StockLocation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "name").Unique(),
		index.Fields("store_id").Unique().Annotations(entsql.IndexAnnotation{Where: "is_default"}).StorageKey("stocklocation_store_default_unique"),
		index.Fields("store_id", "id"),
	}
}

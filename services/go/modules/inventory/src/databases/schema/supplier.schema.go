package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Supplier struct {
	ent.Schema
}

func (Supplier) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Supplier) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("contact_name").Default("").MaxLen(80),
		field.String("phone").Default("").MaxLen(20),
		field.String("email").Optional().Nillable().MaxLen(160),
		field.String("address").Default("").MaxLen(200),
		field.Int("lead_time_days").Default(0),
		field.String("payment_terms").Default("").MaxLen(80),
		field.String("notes").Optional().Nillable().MaxLen(500),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Supplier) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "id")}
}

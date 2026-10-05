package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ShippingAddress struct {
	ent.Schema
}

func (ShippingAddress) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingAddress) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("label").Default("").MaxLen(40),
		field.String("recipient_name").NotEmpty().MaxLen(80),
		field.String("phone").Default("").MaxLen(16),
		field.Bytes("phone_sealed").Optional().Nillable().Sensitive(),
		field.String("line1").NotEmpty().MaxLen(160),
		field.String("line2").Default("").MaxLen(160),
		field.String("postal_code").Default("").MaxLen(12),
		field.String("details").Default("").MaxLen(300),
		field.String("country_code").NotEmpty().MaxLen(2),
		field.UUID("region_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("admin_area_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("city_id", uuid.UUID{}).Optional().Nillable(),
		field.String("free_text_city").Default("").MaxLen(80),
		field.String("free_text_state").Default("").MaxLen(80),
		field.Bool("is_default").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ShippingAddress) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at")}
}

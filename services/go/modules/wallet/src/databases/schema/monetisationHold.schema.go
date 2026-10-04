package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type MonetisationHold struct {
	ent.Schema
}

func (MonetisationHold) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable(),
		field.Bool("is_paused").Default(false),
		field.String("account_status").MaxLen(40).Default("GOOD_STANDING"),
		field.Strings("restrictions").Default([]string{}),
		field.String("reason").MaxLen(120).Default(""),
		field.Time("health_changed_at"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

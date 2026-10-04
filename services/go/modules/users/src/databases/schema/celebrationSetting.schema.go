package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CelebrationSetting struct {
	ent.Schema
}

func (CelebrationSetting) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("timezone").Default("").MaxLen(64),
		field.Bool("birthday_balloons_visible").Default(true),
		field.Time("joined_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CelebrationSetting) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}

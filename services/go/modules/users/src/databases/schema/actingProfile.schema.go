package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ActingProfile struct {
	ent.Schema
}

func (ActingProfile) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("profile_id", uuid.UUID{}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ActingProfile) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}

package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type AdCreatorProgramMember struct {
	ent.Schema
}

func (AdCreatorProgramMember) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable(),
		field.Bool("approved").Default(false),
		field.Time("status_changed_at"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

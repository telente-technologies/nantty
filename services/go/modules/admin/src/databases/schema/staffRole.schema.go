package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffRole struct {
	ent.Schema
}

func (StaffRole) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffRole) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty().MaxLen(60),
		field.String("department").Default("").MaxLen(60),
		field.Strings("permissions").Default([]string{}),
		field.Bool("is_template").Default(false),
		field.UUID("created_by", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StaffRole) Indexes() []ent.Index {
	return []ent.Index{index.Fields("name").Unique()}
}

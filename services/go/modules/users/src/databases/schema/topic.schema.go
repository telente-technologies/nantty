package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type Topic struct {
	ent.Schema
}

func (Topic) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(40).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.Int("position").Default(0),
		field.Bool("active").Default(true),
	}
}

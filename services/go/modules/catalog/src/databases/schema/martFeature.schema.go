package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type MartFeature struct {
	ent.Schema
}

func (MartFeature) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (MartFeature) Fields() []ent.Field {
	return []ent.Field{
		field.String("title").NotEmpty().MaxLen(60),
		field.String("subtitle").Optional().Nillable().MaxLen(90),
		field.String("kind").NotEmpty().MaxLen(30),
		field.String("image_id").NotEmpty().MaxLen(60),
		field.String("target_type").NotEmpty().MaxLen(20),
		field.String("target_value").NotEmpty().MaxLen(200),
		field.JSON("countries", []string{}),
		field.Time("starts_at"),
		field.Time("ends_at").Optional().Nillable(),
		field.Int("priority"),
		field.Bool("is_published").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (MartFeature) Indexes() []ent.Index {
	return []ent.Index{index.Fields("priority"), index.Fields("is_published", "starts_at")}
}

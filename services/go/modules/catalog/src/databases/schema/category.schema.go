package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AttributeDefinition struct {
	Name     string   `json:"name"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type Category struct {
	ent.Schema
}

func (Category) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Category) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("parent_id", uuid.UUID{}).Optional().Nillable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("slug").NotEmpty().MaxLen(80),
		field.String("description").Default("").MaxLen(300),
		field.String("path").Default("").MaxLen(600),
		field.Int("depth").Default(0),
		field.JSON("attribute_definitions", []AttributeDefinition{}).Optional(),
		field.Int("sort_order").Default(0),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Category) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "slug").Unique(),
		index.Fields("parent_id", "sort_order"),
		index.Fields("store_id", "id"),
	}
}

type Brand struct {
	ent.Schema
}

func (Brand) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Brand) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty().MaxLen(80),
		field.String("slug").NotEmpty().MaxLen(80),
		field.String("logo_url").Optional().Nillable().MaxLen(500),
		field.UUID("owner_profile_id", uuid.UUID{}).Optional().Nillable(),
		field.Bool("official").Default(false),
		field.Bool("active").Default(true),
	}
}

func (Brand) Indexes() []ent.Index {
	return []ent.Index{index.Fields("slug").Unique(), index.Fields("active", "name")}
}

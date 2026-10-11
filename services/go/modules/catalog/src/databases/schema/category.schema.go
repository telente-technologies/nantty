package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
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
		field.String("icon_name").Optional().Nillable().MaxLen(40),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Category) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "slug").Unique(),
		index.Fields("slug").Unique().Annotations(entsql.IndexAnnotation{Where: "store_id IS NULL"}).StorageKey("category_platform_slug_unique"),
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
		field.UUID("owner_account_id", uuid.UUID{}).Optional().Nillable(),
		field.String("description").Default("").MaxLen(1000),
		field.String("cover_url").Optional().Nillable().MaxLen(500),
		field.String("website").Optional().Nillable().MaxLen(200),
		field.UUID("category_id", uuid.UUID{}).Optional().Nillable(),
		field.String("category_name").Default("").MaxLen(80),
		field.String("country_code").Default("").MaxLen(2),
		field.String("official_status").Default("NONE").MaxLen(12),
		field.Int("follower_count").Default(0),
		field.Bool("selling_enabled").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Brand) Indexes() []ent.Index {
	return []ent.Index{index.Fields("slug").Unique(), index.Fields("active", "name"), index.Fields("official_status", "id"), index.Fields("owner_account_id")}
}

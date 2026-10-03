package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Gift struct {
	ent.Schema
}

func (Gift) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("description").Optional().Nillable().MaxLen(200),
		field.Enum("tier").Values("basic", "premium", "legendary"),
		field.Int64("price_coins").Positive(),
		field.Enum("animation_engine").Values("alphaVideo", "lottie", "pag", "spriteSheet").Default("lottie"),
		field.String("animation_asset_key").NotEmpty(),
		field.String("preview_asset_key").NotEmpty(),
		field.Int("duration_ms").Positive(),
		field.Enum("display_level").Values("micro", "medium", "large", "global"),
		field.String("sound").Optional().Nillable(),
		field.Enum("haptic").Values("light", "medium", "heavy", "pattern").Optional().Nillable(),
		field.Bool("comboable").Default(false),
		field.Bool("is_active").Default(true),
		field.Int("sort_order").Default(0),
		field.JSON("metadata", map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Gift) Indexes() []ent.Index {
	return []ent.Index{index.Fields("is_active", "sort_order")}
}

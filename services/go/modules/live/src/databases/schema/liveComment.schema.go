package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LiveComment struct {
	ent.Schema
}

func (LiveComment) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveComment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("author_id", uuid.UUID{}).Immutable(),
		field.String("body").NotEmpty().MaxLen(500).Immutable(),
		field.JSON("mentions", []map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.UUID("reply_to_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Time("deleted_at").Optional().Nillable(),
		field.UUID("deleted_by", uuid.UUID{}).Optional().Nillable(),
	}
}

func (LiveComment) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "id"), index.Fields("live_id", "author_id", "id")}
}

type LiveRoomSetting struct {
	ent.Schema
}

func (LiveRoomSetting) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Bool("comments_enabled").Default(true),
		field.Int("slow_mode_seconds").Default(0),
		field.JSON("blocked_words", []string{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.UUID("pinned_comment_id", uuid.UUID{}).Optional().Nillable(),
		field.Bool("record_enabled").Default(false),
	}
}

type LiveModerator struct {
	ent.Schema
}

func (LiveModerator) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveModerator) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.UUID("granted_by", uuid.UUID{}).Immutable(),
	}
}

func (LiveModerator) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "user_id").Unique()}
}

type LiveRestriction struct {
	ent.Schema
}

func (LiveRestriction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveRestriction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("kind").Values("muted", "banned").Immutable(),
		field.UUID("imposed_by", uuid.UUID{}).Immutable(),
		field.String("reason").Optional().Nillable().MaxLen(200),
		field.Time("expires_at").Optional().Nillable(),
	}
}

func (LiveRestriction) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "user_id", "kind").Unique()}
}

package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PlatformSetting struct {
	ent.Schema
}

func (PlatformSetting) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PlatformSetting) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").NotEmpty().MaxLen(100).Immutable(),
		field.Bytes("value").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Int("version").Positive(),
		field.String("updated_by").NotEmpty().MaxLen(64),
		field.Time("updated_at").Default(time.Now),
	}
}

func (PlatformSetting) Indexes() []ent.Index {
	return []ent.Index{index.Fields("key").Unique()}
}

type PlatformSettingRevision struct {
	ent.Schema
}

func (PlatformSettingRevision) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PlatformSettingRevision) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").NotEmpty().MaxLen(100).Immutable(),
		field.Int("version").Positive().Immutable(),
		field.Bytes("value").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("reason").Immutable().MaxLen(500),
		field.String("actor").NotEmpty().Immutable().MaxLen(64),
	}
}

func (PlatformSettingRevision) Indexes() []ent.Index {
	return []ent.Index{index.Fields("key", "version").Unique()}
}

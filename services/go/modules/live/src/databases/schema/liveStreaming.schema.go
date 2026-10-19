package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LiveIngress struct {
	ent.Schema
}

func (LiveIngress) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveIngress) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.String("livekit_ingress_id").NotEmpty().Immutable(),
		field.Enum("protocol").Values("rtmp", "whip").Immutable(),
		field.String("stream_key_hint").MaxLen(8).Immutable(),
		field.Enum("state").Values("active", "revoked").Default("active"),
		field.Time("revoked_at").Optional().Nillable(),
	}
}

func (LiveIngress) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id", "protocol").Unique().Annotations(entsql.IndexWhere("state = 'active'")),
		index.Fields("livekit_ingress_id"),
	}
}

type LiveRecording struct {
	ent.Schema
}

func (LiveRecording) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveRecording) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.String("egress_id").NotEmpty().Immutable(),
		field.Enum("state").Values("recording", "completed", "failed").Default("recording"),
		field.String("object_key").NotEmpty().Immutable(),
		field.Int64("duration_seconds").Default(0),
		field.Int64("size_bytes").Default(0),
		field.String("failure_reason").Optional().Nillable().MaxLen(200),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("reposted_at").Optional().Nillable(),
		field.String("reposted_post_id").Optional().Nillable().MaxLen(80),
		field.Bool("legal_hold").Default(false),
	}
}

func (LiveRecording) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "id"), index.Fields("egress_id").Unique(), index.Fields("created_at").Annotations(entsql.IndexWhere("reposted_at IS NULL AND legal_hold = false"))}
}

type OverlayScene struct {
	ent.Schema
}

func (OverlayScene) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").Immutable().DefaultFunc(NewOpaqueSceneIdentifier).MaxLen(48),
		field.Time("created_at").Default(timeNow).Immutable(),
		field.Time("updated_at").Default(timeNow).UpdateDefault(timeNow),
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("owner_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.Bool("is_main").Default(false),
		field.JSON("layers", []map[string]any{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.JSON("published_layers", []map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("published_name").Optional().Nillable().MaxLen(80),
		field.Time("published_at").Optional().Nillable(),
		field.Int("revision").Default(1),
	}
}

func (OverlayScene) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id", "created_at"),
		index.Fields("live_id").Unique().Annotations(entsql.IndexWhere("is_main")),
	}
}

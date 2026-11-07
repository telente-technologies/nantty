package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GuestSlot struct {
	ent.Schema
}

func (GuestSlot) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GuestSlot) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("role").Values("host", "guest").Default("guest").Immutable(),
		field.Enum("stage_role").Values("speaker", "cohost").Default("speaker").Immutable(),
		field.String("stage_title").Optional().Nillable().MaxLen(32).Immutable(),
		field.Enum("state").Values("invited", "joining", "onStage", "reconnecting", "left", "removed", "declined", "expired", "cancelled", "failed").Default("invited"),
		field.Time("expires_at"),
		field.Time("state_deadline_at").Optional().Nillable(),
		field.Time("joined_at").Optional().Nillable(),
		field.Time("left_at").Optional().Nillable(),
		field.Bool("audio_muted_by_host").Default(false),
		field.Bool("video_muted_by_host").Default(false),
		field.Bool("audio_muted_by_self").Default(false),
		field.Bool("video_muted_by_self").Default(false),
		field.String("end_reason").Optional().Nillable(),
	}
}

func (GuestSlot) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id", "user_id").Unique().Annotations(entsql.IndexWhere("state IN ('invited','joining','onStage','reconnecting')")),
		index.Fields("live_id", "state"),
		index.Fields("state", "expires_at"),
		index.Fields("state", "state_deadline_at"),
	}
}

type JoinRequest struct {
	ent.Schema
}

func (JoinRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (JoinRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("state").Values("pending", "approved", "declined").Default("pending"),
		field.Time("decided_at").Optional().Nillable(),
	}
}

func (JoinRequest) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id", "user_id").Unique().Annotations(entsql.IndexWhere("state = 'pending'")),
		index.Fields("live_id", "state"),
	}
}

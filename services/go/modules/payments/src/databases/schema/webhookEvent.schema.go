package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type WebhookEvent struct {
	ent.Schema
}

func (WebhookEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (WebhookEvent) Fields() []ent.Field {
	return []ent.Field{
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("event_key").NotEmpty().MaxLen(255).Immutable(),
		field.String("event_type").MaxLen(120).Immutable(),
		field.String("reference").MaxLen(255).Immutable(),
		field.String("payload_sha256").MaxLen(64).Immutable(),
		field.Bytes("raw_payload").Optional().Nillable().Immutable(),
		field.Time("processed_at").Optional().Nillable(),
		field.Int("attempt_count").Default(0),
		field.String("last_error").MaxLen(1000).Default(""),
		field.Time("next_attempt_at").Optional().Nillable(),
		field.Time("locked_until").Optional().Nillable(),
		field.String("lease_token").MaxLen(64).Default(""),
		field.Time("dead_lettered_at").Optional().Nillable(),
	}
}

func (WebhookEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider", "event_key").Unique(),
		index.Fields("processed_at", "created_at"),
		index.Fields("next_attempt_at").Annotations(entsql.IndexWhere("processed_at IS NULL AND dead_lettered_at IS NULL")).StorageKey("webhookevent_due"),
	}
}

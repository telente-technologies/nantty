package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AutomationExecution struct {
	ent.Schema
}

func (AutomationExecution) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AutomationExecution) Fields() []ent.Field {
	return []ent.Field{
		field.String("rule_id").MaxLen(64).Immutable(),
		field.Int("rule_version").Immutable(),
		field.String("rule_name").MaxLen(120).Immutable(),
		field.String("event").MaxLen(80).Immutable(),
		field.String("subject_key").MaxLen(200).Immutable(),
		field.String("subject_label").MaxLen(200).Default(""),
		field.Enum("status").Values("running", "succeeded", "skipped", "suppressed", "rate_limited", "failed"),
		field.Bytes("steps").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("input").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.Strings("actions_run").Default([]string{}),
		field.String("error").MaxLen(1000).Optional().Nillable(),
		field.Time("started_at").Immutable(),
		field.Time("finished_at").Optional().Nillable(),
	}
}

func (AutomationExecution) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("rule_id", "started_at"),
		index.Fields("rule_id", "subject_key", "status", "started_at"),
		index.Fields("started_at"),
	}
}

type AutomationEventOccurrence struct {
	ent.Schema
}

func (AutomationEventOccurrence) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AutomationEventOccurrence) Fields() []ent.Field {
	return []ent.Field{
		field.String("event").MaxLen(80).Immutable(),
		field.String("subject_key").MaxLen(200).Immutable(),
		field.String("source_event_id").MaxLen(128).Optional().Nillable().Immutable(),
		field.Time("occurred_at").Immutable(),
	}
}

func (AutomationEventOccurrence) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("event", "subject_key", "occurred_at"),
		index.Fields("occurred_at"),
		index.Fields("source_event_id").Unique(),
	}
}

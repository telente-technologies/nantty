package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AutomationRule struct {
	ent.Schema
}

func (AutomationRule) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").MaxLen(64).NotEmpty().Immutable(),
		field.Int("version").Positive(),
		field.String("event").MaxLen(80),
		field.Bool("is_enabled").Default(false),
		field.Bool("is_archived").Default(false),
		field.Bytes("content").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("change_reason").MaxLen(1000),
		field.String("updated_by_id").MaxLen(64).Default(""),
		field.String("updated_by_name").MaxLen(120).Default(""),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at"),
	}
}

func (AutomationRule) Indexes() []ent.Index {
	return []ent.Index{index.Fields("event", "is_enabled", "is_archived")}
}

type AutomationRuleVersion struct {
	ent.Schema
}

func (AutomationRuleVersion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AutomationRuleVersion) Fields() []ent.Field {
	return []ent.Field{
		field.String("rule_id").MaxLen(64).Immutable(),
		field.Int("version").Positive().Immutable(),
		field.Bytes("content").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.String("change_reason").MaxLen(1000).Immutable(),
		field.String("updated_by_id").MaxLen(64).Default("").Immutable(),
		field.String("updated_by_name").MaxLen(120).Default("").Immutable(),
		field.Bool("is_archived").Default(false).Immutable(),
	}
}

func (AutomationRuleVersion) Indexes() []ent.Index {
	return []ent.Index{index.Fields("rule_id", "version").Unique()}
}

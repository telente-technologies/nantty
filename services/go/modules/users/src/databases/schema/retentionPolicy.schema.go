package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type RetentionPolicy struct {
	ent.Schema
}

func (RetentionPolicy) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("category").Values("account", "orders", "financial", "messages", "analytics", "security_logs", "consents", "marketing").Immutable(),
		field.Enum("action").Values("delete", "anonymize", "retain").Default("retain"),
		field.Int("retention_days").Optional().Nillable().NonNegative(),
		field.Bool("needs_legal_review").Default(true),
		field.Int("version").Default(1),
		field.String("updated_by").Default("system").MaxLen(64),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (RetentionPolicy) Indexes() []ent.Index {
	return []ent.Index{index.Fields("category").Unique()}
}

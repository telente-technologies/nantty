package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type EvidenceRetentionSetting struct {
	ent.Schema
}

func (EvidenceRetentionSetting) Fields() []ent.Field {
	return []ent.Field{
		field.Int("retention_days").Default(180).Min(30).Max(730),
		field.Int("legal_hold_days").Default(730).Min(30).Max(3650),
		field.String("updated_by").MaxLen(64).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

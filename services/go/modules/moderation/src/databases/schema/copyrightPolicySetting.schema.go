package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type CopyrightPolicySetting struct {
	ent.Schema
}

func (CopyrightPolicySetting) Fields() []ent.Field {
	return []ent.Field{
		field.Int("takedown_deadline_hours").Default(48).Min(1).Max(720),
		field.Int("strike_lifetime_days").Default(90).Min(7).Max(730),
		field.Int("warning_lifetime_days").Default(180).Min(7).Max(730),
		field.Int("strike_window_days").Default(90).Min(7).Max(730),
		field.Int("restriction_threshold").Default(3).Min(1).Max(20),
		field.Int("suspension_review_threshold").Default(3).Min(1).Max(20),
		field.Int("restriction_days").Default(30).Min(1).Max(90),
		field.String("updated_by").MaxLen(64).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

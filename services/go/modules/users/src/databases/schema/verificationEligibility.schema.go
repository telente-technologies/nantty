package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type VerificationEligibility struct {
	ent.Schema
}

func (VerificationEligibility) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (VerificationEligibility) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold"),
		field.Enum("state").Values("assessed", "requested", "eligible").Default("assessed"),
		field.Enum("tier").Values("buy_now", "request", "blocked").Default("request"),
		field.Int("trust_score").Default(0).Min(0).Max(100),
		field.Strings("reasons").Default([]string{}),
		field.String("score_source").Default("").MaxLen(60),
		field.Time("requested_at").Optional().Nillable(),
		field.Time("last_checked_at").Optional().Nillable(),
		field.Time("next_check_at").Optional().Nillable(),
		field.Time("notified_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (VerificationEligibility) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id").Unique(), index.Fields("state", "next_check_at")}
}

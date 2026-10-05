package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffConsent struct {
	ent.Schema
}

func (StaffConsent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffConsent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("staff_id", uuid.UUID{}).Immutable(),
		field.String("policy_version").NotEmpty().MaxLen(40).Immutable(),
		field.JSON("categories", map[string]bool{}).Immutable(),
		field.String("source").NotEmpty().MaxLen(40).Immutable(),
		field.Time("decided_at").Immutable(),
		field.String("ip_address").Default("").MaxLen(64).Immutable(),
		field.String("user_agent").Default("").MaxLen(255).Immutable(),
	}
}

func (StaffConsent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("staff", StaffAccount.Type).Ref("consents").Field("staff_id").Unique().Required().Immutable(),
	}
}

func (StaffConsent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("staff_id", "created_at")}
}

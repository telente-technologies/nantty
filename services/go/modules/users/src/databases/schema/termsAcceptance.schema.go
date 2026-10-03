package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type TermsAcceptance struct {
	ent.Schema
}

func (TermsAcceptance) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (TermsAcceptance) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("terms_version").NotEmpty().MaxLen(40).Immutable(),
		field.Time("accepted_at").Immutable(),
		field.String("ip_address").Default("").MaxLen(64).Immutable(),
		field.String("user_agent").Default("").MaxLen(255).Immutable(),
	}
}

func (TermsAcceptance) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "terms_version").Unique()}
}

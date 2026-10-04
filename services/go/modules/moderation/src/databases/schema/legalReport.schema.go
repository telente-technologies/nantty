package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LegalReport struct {
	ent.Schema
}

func (LegalReport) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LegalReport) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("incident_id", uuid.UUID{}).Immutable(),
		field.String("live_id").MaxLen(128).Immutable(),
		field.UUID("host_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("category").MaxLen(40).Immutable(),
		field.String("provider").MaxLen(60).Default("").Immutable(),
		field.String("match_reference").MaxLen(200).Default("").Immutable(),
		field.String("evidence_key").MaxLen(512).Default(""),
		field.Enum("status").Values("pending_legal_review", "submitted", "closed").Default("pending_legal_review"),
		field.String("external_reference").MaxLen(200).Default(""),
		field.Time("submitted_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LegalReport) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("incident_id").Unique(),
		index.Fields("status", "created_at"),
	}
}

package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LegalNotice struct {
	ent.Schema
}

func (LegalNotice) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LegalNotice) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("version_id", uuid.UUID{}).Immutable(),
		field.String("document_key").MaxLen(40).Immutable(),
		field.Int("version_number").Immutable(),
		field.String("subject").MaxLen(200).Immutable(),
		field.Enum("status").Values("queued", "sending", "completed").Default("queued"),
		field.Int("recipient_count").Default(0),
		field.Int("sent_count").Default(0),
		field.Int("excluded_hard_bounces").Default(0),
		field.Int("excluded_suppressed").Default(0),
		field.Int("batch_size").Default(50),
		field.Int("rate_per_second").Default(14),
		field.Int("batches_done").Default(0),
		field.String("queued_by").MaxLen(64).Default(""),
		field.String("queued_by_name").MaxLen(120).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LegalNotice) Indexes() []ent.Index {
	return []ent.Index{index.Fields("version_id"), index.Fields("status", "created_at")}
}

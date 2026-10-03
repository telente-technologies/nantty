package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LegalNoticeDraft struct {
	ent.Schema
}

func (LegalNoticeDraft) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("version_id", uuid.UUID{}).Immutable(),
		field.String("subject").MaxLen(200).Default(""),
		field.Text("summary_text").Default(""),
		field.Strings("what_changed").Default([]string{}),
		field.String("reaccept_note").MaxLen(500).Default(""),
		field.String("updated_by_name").MaxLen(120).Default(""),
		field.Bytes("test_sends").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LegalNoticeDraft) Indexes() []ent.Index {
	return []ent.Index{index.Fields("version_id").Unique()}
}

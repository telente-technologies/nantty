package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdMedia struct{ ent.Schema }

func (AdMedia) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdMedia) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("uploaded_by", uuid.UUID{}).Immutable(),
		field.String("file_name").NotEmpty().MaxLen(200).Immutable(),
		field.String("mime_type").MaxLen(60).Immutable(),
		field.Int64("size_bytes").Immutable(),
		field.Enum("kind").Values("image", "video").Immutable(),
		field.String("object_key").MaxLen(300).Immutable(),
		field.Enum("status").Values("pending_upload", "processing", "ready", "failed").Default("pending_upload"),
		field.Int("width").Default(0),
		field.Int("height").Default(0),
		field.Int("duration_seconds").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdMedia) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at"), index.Fields("status", "created_at")}
}

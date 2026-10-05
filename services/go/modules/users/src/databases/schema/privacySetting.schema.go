package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type PrivacySetting struct {
	ent.Schema
}

func (PrivacySetting) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Bool("analytics").Default(false),
		field.Bool("personalization").Default(false),
		field.Bool("personalized_ads").Default(false),
		field.Bool("marketing").Default(false),
		field.Enum("marketing_frequency").Values("weekly", "important_only", "off").Default("weekly"),
		field.Enum("who_can_message_me").Values("everyone", "following", "followers", "nobody").Default("everyone"),
		field.Enum("who_can_mention_me").Values("everyone", "following", "no_one").Default("everyone"),
		field.String("policy_version").Default("").MaxLen(40),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PrivacySetting) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}

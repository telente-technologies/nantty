package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type VerificationCase struct {
	ent.Schema
}

func (VerificationCase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (VerificationCase) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold").Immutable(),
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable().Unique(),
		field.String("plan_code").Default("").MaxLen(40),
		field.String("payment_channel").Default("").MaxLen(20),
		field.Enum("status").Values("awaiting_consent", "awaiting_capture", "processing", "under_review", "approved", "rejected").Default("awaiting_consent"),
		field.Enum("refund_status").Values("not_applicable", "requested", "refunded", "not_charged", "failed", "manual_store_refund").Default("not_applicable"),
		field.String("consent_version").Default("").MaxLen(40),
		field.Time("consent_at").Optional().Nillable(),
		field.String("smile_job_id").Optional().Nillable().MaxLen(80).Unique(),
		field.String("smile_reference").Default("").MaxLen(80),
		field.String("smile_product").Default("").MaxLen(40),
		field.String("smile_result_code").Default("").MaxLen(10),
		field.String("document_type").Default("").MaxLen(40),
		field.String("document_country").Default("").MaxLen(2),
		field.String("liveness_result").Default("pending").MaxLen(20),
		field.String("document_result").Default("pending").MaxLen(20),
		field.String("face_match_result").Default("pending").MaxLen(20),
		field.String("database_result").Default("pending").MaxLen(20),
		field.Float("face_match_confidence").Default(0),
		field.Float("name_match_score").Default(0),
		field.Int("trust_score").Default(0).Min(0).Max(100),
		field.Bool("eligible_at_payment").Default(false),
		field.String("document_fingerprint").Default("").MaxLen(64),
		field.Strings("decision_reasons").Default([]string{}),
		field.Strings("fraud_signals").Default([]string{}),
		field.String("decision_reason").Default("").MaxLen(1000),
		field.String("decided_by_name").Default("").MaxLen(120),
		field.Time("decided_at").Optional().Nillable(),
		field.Time("verified_at").Optional().Nillable(),
		field.Int("callback_count").Default(0).NonNegative(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (VerificationCase) Indexes() []ent.Index {
	return []ent.Index{index.Fields("status", "created_at"), index.Fields("profile_id", "status"), index.Fields("document_fingerprint")}
}

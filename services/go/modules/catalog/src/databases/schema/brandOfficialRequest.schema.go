package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type BrandRequestDocument struct {
	Id         string    `json:"id"`
	Kind       string    `json:"kind"`
	Label      string    `json:"label"`
	MediaId    string    `json:"mediaId"`
	UploadedAt time.Time `json:"uploadedAt"`
}

type BrandTrademark struct {
	RegistrationNumber string `json:"registrationNumber"`
	Jurisdiction       string `json:"jurisdiction"`
	NiceClass          string `json:"niceClass"`
	RegisteredOwner    string `json:"registeredOwner"`
	RegisteredOn       string `json:"registeredOn"`
	ExpiresOn          string `json:"expiresOn"`
}

type BrandOfficialRequest struct {
	ent.Schema
}

func (BrandOfficialRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BrandOfficialRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("brand_id", uuid.UUID{}).Immutable(),
		field.UUID("submitted_by_account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.JSON("trademark", BrandTrademark{}),
		field.String("cac_registration_number").Default("").MaxLen(40),
		field.String("cac_company_name").Default("").MaxLen(160),
		field.String("contact_email").Default("").MaxLen(160),
		field.JSON("documents", []BrandRequestDocument{}).Optional(),
		field.String("last_decision_reason").Optional().Nillable().MaxLen(1000),
		field.Time("decided_at").Optional().Nillable(),
		field.String("decided_by_name").Optional().Nillable().MaxLen(120),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (BrandOfficialRequest) Indexes() []ent.Index {
	return []ent.Index{index.Fields("brand_id", "id")}
}

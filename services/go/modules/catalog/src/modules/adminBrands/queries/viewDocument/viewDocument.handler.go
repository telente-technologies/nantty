package viewdocument

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brandofficialrequest"
	brandservices "nantty/modules/catalog/src/modules/adminBrands/services"
	"nantty/modules/catalog/src/services"
)

type Query struct {
	Actor      services.StaffActor
	BrandId    uuid.UUID
	DocumentId string
}

type DocumentView struct {
	DocumentId    string    `json:"documentId"`
	Kind          string    `json:"kind"`
	Url           string    `json:"url"`
	ExpiresAt     time.Time `json:"expiresAt"`
	WatermarkText string    `json:"watermarkText"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (DocumentView, error) {
	requests, err := handler.Container.Client.BrandOfficialRequest.Query().Where(brandofficialrequest.BrandID(query.BrandId)).Order(ent.Desc(brandofficialrequest.FieldID)).All(ctx)
	if err != nil {
		return DocumentView{}, err
	}
	for _, request := range requests {
		for _, document := range request.Documents {
			if document.Id != query.DocumentId {
				continue
			}
			if handler.Container.PrivateMedia == nil {
				return DocumentView{}, catalogerrors.NotFound
			}
			url, expiresAt, err := handler.Container.PrivateMedia.SignedUrl(ctx, document.MediaId, query.Actor.Staff.Id, "brand official store review")
			if err != nil {
				return DocumentView{}, err
			}
			if maximum := handler.Container.Now().Add(5 * time.Minute); expiresAt.IsZero() || expiresAt.After(maximum) {
				expiresAt = maximum
			}
			viewer := query.Actor.Staff.Name
			if viewer == "" {
				viewer = query.Actor.Staff.Id
			}
			view := DocumentView{DocumentId: document.Id, Kind: document.Kind, Url: url, ExpiresAt: expiresAt,
				WatermarkText: "Nantty Admin — confidential · " + viewer + " · " + handler.Container.Now().UTC().Format(time.RFC3339)}
			return view, services.RecordStaffChange(ctx, handler.Container, query.Actor, services.StaffChange{
				Action: "brand.document_viewed", SubjectType: brandservices.SubjectType, SubjectId: query.BrandId.String(), Reason: "Opened " + document.Kind,
				After: map[string]string{"documentId": document.Id, "kind": document.Kind},
			})
		}
	}
	return DocumentView{}, catalogerrors.NotFound
}

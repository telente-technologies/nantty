package getlegaldocument

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalversion"
	listlegaldocuments "nantty/modules/users/src/modules/legal/queries/listLegalDocuments"
	"nantty/modules/users/src/modules/legal/services"
)

type Result struct {
	Document listlegaldocuments.DocumentSummary `json:"document"`
	Versions []services.VersionView             `json:"versions"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, key string) (Result, error) {
	definition, known := services.DefinitionOf(key)
	if !known {
		return Result{}, usersErrors.NotFound("That document does not exist.")
	}
	summary, err := listlegaldocuments.Summarize(ctx, handler.Container, definition)
	if err != nil {
		return Result{}, err
	}
	rows, err := handler.Container.Client.LegalVersion.Query().Where(legalversion.DocumentKey(key)).Order(ent.Desc(legalversion.FieldVersionNumber)).All(ctx)
	result := Result{Document: summary, Versions: []services.VersionView{}}
	for _, row := range rows {
		result.Versions = append(result.Versions, services.ConvertVersionToView(row))
	}
	return result, err
}

package getlegaldocument

import (
	"context"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/legalversion"
	listlegaldocuments "zudomart/modules/users/src/modules/legal/queries/listLegalDocuments"
	"zudomart/modules/users/src/modules/legal/services"
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

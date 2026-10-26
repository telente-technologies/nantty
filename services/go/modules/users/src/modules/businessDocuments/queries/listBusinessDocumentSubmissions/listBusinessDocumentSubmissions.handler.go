package listbusinessdocumentsubmissions

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/modules/businessDocuments/services"
)

const pageSize = 25
const scanWindow = 200

type Result struct {
	Data       []services.SubmissionView `json:"data"`
	NextCursor *string                   `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, status, search, cursor string) (Result, error) {
	accountIds, err := handler.Container.Client.BusinessDocument.Query().Where(businessdocument.IsCurrent(true), businessdocument.IsUploaded(true)).Unique(true).Order(ent.Asc(businessdocument.FieldAccountID)).Select(businessdocument.FieldAccountID).Strings(ctx)
	if err != nil {
		return Result{}, err
	}
	wanted := strings.ToUpper(status)
	if wanted == "" {
		wanted = "PENDING"
	}
	result := Result{Data: []services.SubmissionView{}}
	for index, raw := range accountIds {
		if index >= scanWindow {
			break
		}
		if cursor != "" && raw <= cursor {
			continue
		}
		accountId, err := uuid.Parse(raw)
		if err != nil {
			continue
		}
		view, err := services.BuildSubmissionView(ctx, handler.Container, accountId)
		if err != nil {
			return result, err
		}
		if (wanted != "ALL" && view.OverallStatus != wanted) || (search != "" && !matches(view, search)) {
			continue
		}
		if len(result.Data) == pageSize {
			next := result.Data[len(result.Data)-1].Id
			result.NextCursor = &next
			break
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}

func matches(view services.SubmissionView, search string) bool {
	needle := strings.ToLower(strings.TrimPrefix(search, "@"))
	return strings.Contains(strings.ToLower(view.User.Username), needle) || strings.Contains(strings.ToLower(view.StoreName), needle)
}

package listsellerreviews

import (
	"context"
	"strconv"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/review"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type sortSpec struct {
	field      string
	descending bool
}

var sortSpecs = map[string]sortSpec{
	"newest": {review.FieldID, true}, "oldest": {review.FieldID, false},
	"lowest": {review.FieldRating, false}, "highest": {review.FieldRating, true}, "helpful": {review.FieldHelpfulCount, true},
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.SellerReviewView], error) {
	empty := httpserver.CursorPage[types.SellerReviewView]{}
	spec, known := sortSpecs[query.Sort]
	if !known {
		spec = sortSpecs["newest"]
	}
	conditions := []predicate.Review{review.StoreID(query.StoreId), review.StatusNEQ(enums.ReviewHidden)}
	if query.Kind == enums.ReviewKindProduct || query.Kind == enums.ReviewKindStore {
		conditions = append(conditions, review.Kind(query.Kind))
	}
	if query.Rating > 0 {
		conditions = append(conditions, review.Rating(query.Rating))
	}
	if query.Replied == "yes" {
		conditions = append(conditions, review.ReplyBodyNotNil())
	} else if query.Replied == "no" {
		conditions = append(conditions, review.ReplyBodyIsNil())
	}
	if query.Text != "" {
		conditions = append(conditions, review.Or(review.BodyContainsFold(query.Text), review.OrderNumberContainsFold(query.Text)))
	}
	cursor, err := cursorCondition(query.Cursor, spec)
	if err != nil {
		return empty, err
	}
	if cursor != nil {
		conditions = append(conditions, cursor)
	}
	order := ent.Asc
	if spec.descending {
		order = ent.Desc
	}
	request := handler.Container.Client.Review.Query().Where(conditions...)
	if spec.field == review.FieldID {
		request = request.Order(order(review.FieldID))
	} else {
		request = request.Order(order(spec.field), order(review.FieldID))
	}
	rows, err := request.Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = cursorOf(rows[len(rows)-1], spec.field)
	}
	views, err := services.SellerReviewViews(ctx, handler.Container, rows)
	return httpserver.NewCursorPage(views, nextCursor), err
}

func cursorOf(row *ent.Review, field string) string {
	switch field {
	case review.FieldRating:
		return utils.EncodeCursor(strconv.Itoa(row.Rating), row.ID.String())
	case review.FieldHelpfulCount:
		return utils.EncodeCursor(strconv.Itoa(row.HelpfulCount), row.ID.String())
	}
	return utils.EncodeCursor("0", row.ID.String())
}

func cursorCondition(raw string, spec sortSpec) (predicate.Review, error) {
	parts, err := utils.DecodeCursor(raw, 2)
	if err != nil || parts == nil {
		return nil, err
	}
	number, numberError := strconv.Atoi(parts[0])
	identifier, idError := uuid.Parse(parts[1])
	if numberError != nil || idError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	return predicate.Review(func(selector *sql.Selector) {
		idColumn := selector.C(review.FieldID)
		if spec.field == review.FieldID {
			if spec.descending {
				selector.Where(sql.LT(idColumn, identifier))
			} else {
				selector.Where(sql.GT(idColumn, identifier))
			}
			return
		}
		column := selector.C(spec.field)
		if spec.descending {
			selector.Where(sql.Or(sql.LT(column, number), sql.And(sql.EQ(column, number), sql.LT(idColumn, identifier))))
			return
		}
		selector.Where(sql.Or(sql.GT(column, number), sql.And(sql.EQ(column, number), sql.GT(idColumn, identifier))))
	}), nil
}

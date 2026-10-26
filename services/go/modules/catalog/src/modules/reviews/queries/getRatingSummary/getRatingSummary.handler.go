package getratingsummary

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent/review"
)

type Handler struct {
	Container *container.Container
}

type Summary struct {
	Average      float64        `json:"average"`
	Count        int            `json:"count"`
	Distribution map[string]int `json:"distribution"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Summary, error) {
	ratings, err := handler.Container.Client.Review.Query().Where(review.ProductID(query.ProductId), review.StatusNEQ(enums.ReviewHidden)).Select(review.FieldRating).Ints(ctx)
	if err != nil {
		return Summary{}, err
	}
	summary := Summary{Count: len(ratings), Distribution: map[string]int{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}}
	total := 0
	for _, rating := range ratings {
		total += rating
		summary.Distribution[string(rune('0'+rating))]++
	}
	if len(ratings) > 0 {
		summary.Average = float64(total) / float64(len(ratings))
	}
	return summary, nil
}

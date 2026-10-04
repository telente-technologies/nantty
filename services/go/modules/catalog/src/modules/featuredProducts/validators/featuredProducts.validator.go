package validators

import (
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	"zudomart/modules/catalog/src/utils"
)

const (
	MaximumFeaturedProducts     = 12
	MaximumMartFeaturedProducts = 4
)

func ValidateReplaceFeaturedProducts(request dtos.ReplaceFeaturedProductsRequest) error {
	issues := utils.Issues{}
	if len(request.Items) > MaximumFeaturedProducts {
		issues.Add("items", "must contain at most 12 products")
	}
	seen, martCount := map[uuid.UUID]bool{}, 0
	for index, item := range request.Items {
		path := "items." + strconv.Itoa(index)
		identifier, err := uuid.Parse(item.ProductId)
		if err != nil {
			issues.Add(path+".productId", "must be a valid id")
		} else if seen[identifier] {
			issues.Add(path+".productId", "must be unique")
		}
		seen[identifier] = true
		switch item.Placement {
		case "mart":
			martCount++
		case "storefront":
		default:
			issues.Add(path+".placement", "must be storefront or mart")
		}
	}
	if martCount > MaximumMartFeaturedProducts {
		issues.Add("items", "must contain at most 4 products placed in the mart")
	}
	return issues.AsError()
}

package dtos

import (
	"time"

	"zudomart/modules/catalog/src/utils"
)

type CreateCategoryRequest struct {
	Name     string  `json:"name"`
	Slug     *string `json:"slug"`
	ParentId *string `json:"parentId"`
	IconName *string `json:"iconName"`
	Reason   string  `json:"reason"`
}

type UpdateCategoryRequest struct {
	Name     *string              `json:"name"`
	Slug     *string              `json:"slug"`
	ParentId utils.NullableString `json:"parentId"`
	IconName utils.NullableString `json:"iconName"`
	Reason   string               `json:"reason"`
}

type MoveRequest struct {
	Direction string `json:"direction"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type CatalogCategory struct {
	Id                            string    `json:"id"`
	ParentId                      *string   `json:"parentId"`
	Name                          string    `json:"name"`
	Slug                          string    `json:"slug"`
	IconName                      *string   `json:"iconName"`
	IsActive                      bool      `json:"isActive"`
	SortOrder                     int       `json:"sortOrder"`
	ProductCount                  int       `json:"productCount"`
	CommissionOverrideBasisPoints *int      `json:"commissionOverrideBasisPoints"`
	UpdatedAt                     time.Time `json:"updatedAt"`
}

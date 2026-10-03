package dtos

type CreateLocationRequest struct {
	Name    string  `json:"name"`
	Kind    string  `json:"kind"`
	Address string  `json:"address"`
	City    string  `json:"city"`
	State   string  `json:"state"`
	Phone   *string `json:"phone"`
}

type UpdateLocationRequest struct {
	Name       *string `json:"name"`
	Kind       *string `json:"kind"`
	Address    *string `json:"address"`
	City       *string `json:"city"`
	State      *string `json:"state"`
	Phone      *string `json:"phone"`
	ClearPhone bool    `json:"-"`
	Active     *bool   `json:"active"`
	IsDefault  *bool   `json:"isDefault"`
}

package types

import (
	"time"

	"github.com/google/uuid"

	"nantty/platform/money"
)

type StoreLocationView struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Kind      string  `json:"kind"`
	Address   string  `json:"address"`
	City      string  `json:"city"`
	State     string  `json:"state"`
	Country   string  `json:"country"`
	Phone     *string `json:"phone"`
	IsDefault bool    `json:"isDefault"`
	Active    bool    `json:"active"`
}

type InventoryLevelRowView struct {
	VariantId         string       `json:"variantId"`
	ProductId         string       `json:"productId"`
	ProductName       string       `json:"productName"`
	VariantTitle      string       `json:"variantTitle"`
	Sku               string       `json:"sku"`
	ImageUrl          *string      `json:"imageUrl"`
	LocationId        string       `json:"locationId"`
	OnHand            int          `json:"onHand"`
	Reserved          int          `json:"reserved"`
	Available         int          `json:"available"`
	LowStockThreshold int          `json:"lowStockThreshold"`
	CostPrice         *money.Money `json:"costPrice"`
	StockValue        *money.Money `json:"stockValue"`
	ReorderPoint      int          `json:"reorderPoint"`
	ReorderQuantity   int          `json:"reorderQuantity"`
}

type InventorySummaryView struct {
	LocationId        *string     `json:"locationId"`
	SkuCount          int         `json:"skuCount"`
	OnHand            int         `json:"onHand"`
	Reserved          int         `json:"reserved"`
	Available         int         `json:"available"`
	LowStockCount     int         `json:"lowStockCount"`
	OutOfStockCount   int         `json:"outOfStockCount"`
	NeedsReorderCount int         `json:"needsReorderCount"`
	StockValue        money.Money `json:"stockValue"`
	RetailValue       money.Money `json:"retailValue"`
}

type InventoryLocationSummaryView struct {
	LocationId    string      `json:"locationId"`
	Name          string      `json:"name"`
	Kind          string      `json:"kind"`
	City          string      `json:"city"`
	IsDefault     bool        `json:"isDefault"`
	Active        bool        `json:"active"`
	SkuCount      int         `json:"skuCount"`
	OnHand        int         `json:"onHand"`
	Reserved      int         `json:"reserved"`
	LowStockCount int         `json:"lowStockCount"`
	StockValue    money.Money `json:"stockValue"`
}

type PersonView struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type StockAdjustmentView struct {
	Id            string     `json:"id"`
	VariantId     string     `json:"variantId"`
	ProductName   string     `json:"productName"`
	VariantTitle  string     `json:"variantTitle"`
	LocationId    string     `json:"locationId"`
	QuantityDelta int        `json:"quantityDelta"`
	Reason        string     `json:"reason"`
	Note          *string    `json:"note"`
	CreatedBy     PersonView `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type StockTransferLineView struct {
	VariantId    string `json:"variantId"`
	ProductName  string `json:"productName"`
	VariantTitle string `json:"variantTitle"`
	Quantity     int    `json:"quantity"`
}

type StockTransferView struct {
	Id             string                  `json:"id"`
	Reference      string                  `json:"reference"`
	FromLocationId string                  `json:"fromLocationId"`
	ToLocationId   string                  `json:"toLocationId"`
	Status         string                  `json:"status"`
	Lines          []StockTransferLineView `json:"lines"`
	Note           *string                 `json:"note"`
	CreatedBy      PersonView              `json:"createdBy"`
	CreatedAt      time.Time               `json:"createdAt"`
	ReceivedAt     *time.Time              `json:"receivedAt"`
}

type SupplierView struct {
	Id           string    `json:"id"`
	Name         string    `json:"name"`
	ContactName  string    `json:"contactName"`
	Phone        string    `json:"phone"`
	Email        *string   `json:"email"`
	Address      string    `json:"address"`
	LeadTimeDays int       `json:"leadTimeDays"`
	PaymentTerms string    `json:"paymentTerms"`
	Notes        *string   `json:"notes"`
	ProductCount int       `json:"productCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

type InventoryMovementView struct {
	Id            string    `json:"id"`
	Kind          string    `json:"kind"`
	VariantId     string    `json:"variantId"`
	ProductId     string    `json:"productId"`
	ProductName   string    `json:"productName"`
	VariantTitle  string    `json:"variantTitle"`
	Sku           string    `json:"sku"`
	LocationId    string    `json:"locationId"`
	QuantityDelta int       `json:"quantityDelta"`
	Reference     string    `json:"reference"`
	Note          *string   `json:"note"`
	ActorName     string    `json:"actorName"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ReorderSupplierView struct {
	Id           string `json:"id"`
	Name         string `json:"name"`
	LeadTimeDays int    `json:"leadTimeDays"`
}

type ReorderSuggestionView struct {
	VariantId         string               `json:"variantId"`
	ProductId         string               `json:"productId"`
	ProductName       string               `json:"productName"`
	VariantTitle      string               `json:"variantTitle"`
	Sku               string               `json:"sku"`
	LocationId        string               `json:"locationId"`
	Available         int                  `json:"available"`
	ReorderPoint      int                  `json:"reorderPoint"`
	ReorderQuantity   int                  `json:"reorderQuantity"`
	SuggestedQuantity int                  `json:"suggestedQuantity"`
	Supplier          *ReorderSupplierView `json:"supplier"`
	EstimatedCost     *money.Money         `json:"estimatedCost"`
}

type VariantReorderView struct {
	VariantId       uuid.UUID
	ReorderPoint    int
	ReorderQuantity int
}

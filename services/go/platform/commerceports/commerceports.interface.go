package commerceports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"zudomart/platform/money"
)

var ErrPortNotRegistered = errors.New("commerce port not registered")

type InsufficientStockError struct {
	VariantId uuid.UUID
	Requested int
	Available int
}

func (failure InsufficientStockError) Error() string {
	return fmt.Sprintf("variant %s has %d available but %d requested", failure.VariantId, failure.Available, failure.Requested)
}

type ProductSnapshot struct {
	ProductId       uuid.UUID
	VariantId       uuid.UUID
	StoreId         uuid.UUID
	SellerAccountId uuid.UUID
	ProductTitle    string
	VariantTitle    string
	Sku             string
	Size            string
	Color           string
	ImageUrl        string
	UnitPrice       money.Money
	CostPrice       *money.Money
	Taxable         bool
	TrackInventory  bool
	CategoryId      *uuid.UUID
	CategoryName    string
	Purchasable     bool
}

type VariantDescription struct {
	ProductId    uuid.UUID
	VariantId    uuid.UUID
	StoreId      uuid.UUID
	ProductTitle string
	VariantTitle string
	Sku          string
	Barcode      string
	ImageUrl     string
	CostPrice    *money.Money
	RetailPrice  money.Money
	ProductState string
	TracksStock  bool
	SupplierId   *uuid.UUID
}

type StoreSnapshot struct {
	StoreId        uuid.UUID
	OwnerAccountId uuid.UUID
	Name           string
	Slug           string
	LogoUrl        string
	CountryCode    string
	Currency       money.CurrencyCode
	Verified       bool
	Active         bool
	RatingAverage  float64
	RatingCount    int
}

type StoreAccess struct {
	StoreId        uuid.UUID
	OwnerAccountId uuid.UUID
	Role           string
	Permissions    []string
	Currency       money.CurrencyCode
	CountryCode    string
}

func (access StoreAccess) Allows(permission string) bool {
	return RoleAllows(access.Role, access.Permissions, permission)
}

type VariantReference struct {
	ProductId uuid.UUID
	VariantId uuid.UUID
}

type CatalogReader interface {
	ListStoreVariants(ctx context.Context, storeId uuid.UUID) ([]VariantReference, error)
	SearchStoreVariantIds(ctx context.Context, storeId uuid.UUID, text string, limit int) ([]uuid.UUID, error)
	DetachSupplierFromProducts(ctx context.Context, storeId, supplierId uuid.UUID) error
	CountActiveProductsBySupplier(ctx context.Context, storeId uuid.UUID, supplierIds []uuid.UUID) (map[uuid.UUID]int, error)
	ResolveProductsForCheckout(ctx context.Context, variantIds []uuid.UUID) (map[uuid.UUID]ProductSnapshot, error)
	DescribeVariants(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID]VariantDescription, error)
	DescribeStores(ctx context.Context, storeIds []uuid.UUID) (map[uuid.UUID]StoreSnapshot, error)
	FindStoreAccessForAccount(ctx context.Context, accountId uuid.UUID, requestedStoreId *uuid.UUID) (StoreAccess, bool, error)
}

type StockLine struct {
	VariantId uuid.UUID
	StoreId   uuid.UUID
	Quantity  int
}

type ReserveStockRequest struct {
	Reference string
	ExpiresAt time.Time
	Lines     []StockLine
}

type FulfilStockRequest struct {
	Reference      string
	StoreId        uuid.UUID
	FromLocationId *uuid.UUID
	ActorName      string
}

type RestockRequest struct {
	Reference  string
	StoreId    uuid.UUID
	LocationId uuid.UUID
	Lines      []StockLine
	ActorName  string
}

type OpeningStock struct {
	LocationId uuid.UUID
	Quantity   int
}

type ProvisionVariantStockRequest struct {
	StoreId          uuid.UUID
	ProductId        uuid.UUID
	VariantId        uuid.UUID
	LowStockLevel    int
	ReorderPoint     int
	ReorderQuantity  int
	Listed           bool
	Opening          []OpeningStock
	ActorAccountId   uuid.UUID
	MovementRefToken string
}

type VariantStockLevel struct {
	LocationId      uuid.UUID
	OnHand          int
	Reserved        int
	LowStockLevel   int
	ReorderPoint    int
	ReorderQuantity int
}

type InventoryStock interface {
	StockLevelsForVariants(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID][]VariantStockLevel, error)
	Reserve(ctx context.Context, request ReserveStockRequest) error
	Release(ctx context.Context, reference string) error
	Confirm(ctx context.Context, reference string) error
	Fulfil(ctx context.Context, request FulfilStockRequest) error
	Restock(ctx context.Context, request RestockRequest) error
	AvailableByVariant(ctx context.Context, variantIds []uuid.UUID) (map[uuid.UUID]int, error)
	OnHandByVariant(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID]int, error)
	ProvisionVariantStock(ctx context.Context, request ProvisionVariantStockRequest) error
	SetProductListed(ctx context.Context, storeId, productId uuid.UUID, listed bool) error
	EnsureDefaultLocation(ctx context.Context, storeId uuid.UUID, countryCode string) (uuid.UUID, error)
	StoreOwnsLocations(ctx context.Context, storeId uuid.UUID, locationIds []uuid.UUID) (bool, error)
	ListSuppliersForStore(ctx context.Context, storeId uuid.UUID, supplierIds []uuid.UUID) (map[uuid.UUID]string, error)
}

type StoreRewardsLookup interface {
	EarnBackBasisPointsByStore(ctx context.Context, storeIds []uuid.UUID) (map[uuid.UUID]int, error)
}

type PurchaseVerifier interface {
	FindReceivedPurchaseOfProduct(ctx context.Context, accountId, productId uuid.UUID) (orderNumber string, found bool, err error)
	FindReceivedPurchaseFromStore(ctx context.Context, accountId, storeId uuid.UUID) (orderNumber string, found bool, err error)
}

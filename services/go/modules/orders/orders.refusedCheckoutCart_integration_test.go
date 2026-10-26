package orders

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/cart"
	"nantty/modules/orders/src/generated/ent/cartitem"
	"nantty/modules/orders/src/services"
)

func TestARefusedCheckoutPutsTheItemsBackInTheBuyersCart(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := uuid.New()
	groupId := seedGroup(t, module, store, "pending", "pending", false)
	group := module.Container.Client.OrderGroup.GetX(ctx, groupId)
	productId, variantId := uuid.New(), uuid.New()
	err := module.Container.Client.OrderItem.Create().SetOrderGroupID(groupId).SetStoreID(store).SetProductID(productId).SetVariantID(variantId).SetQuantity(2).
		SetProductName("Ankara dress").SetUnitPriceMinor(150_000).SetLineTotalMinor(300_000).Exec(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := services.RestoreCartOfRefusedCheckout(ctx, module.Container, []*ent.OrderGroup{group}); err != nil {
		t.Fatal(err)
	}
	if err := services.RestoreCartOfRefusedCheckout(ctx, module.Container, []*ent.OrderGroup{group}); err != nil {
		t.Fatal(err)
	}
	cartId := module.Container.Client.Cart.Query().Where(cart.AccountID(group.BuyerAccountID)).OnlyIDX(ctx)
	line := module.Container.Client.CartItem.Query().Where(cartitem.CartID(cartId), cartitem.VariantID(variantId)).OnlyX(ctx)
	if line.Quantity != 4 || line.StoreID != store || line.ProductID != productId {
		t.Fatalf("the refused items are back in the cart, merged into one line: %+v", line)
	}
}

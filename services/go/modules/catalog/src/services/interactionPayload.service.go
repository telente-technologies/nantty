package services

import (
	"context"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/store"
)

const maximumInteractionQueryLength = 200

var interactionSurfacePattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,40}$`)

var interactionIntegerBounds = map[string]float64{"position": 10_000, "resultCount": 1_000_000}

func sanitizeInteractionValue(key string, value any) (any, bool) {
	switch key {
	case "productId", "storeId", "categoryId", "variantId":
		text, isText := value.(string)
		parsed, err := uuid.Parse(text)
		if !isText || err != nil {
			return nil, false
		}
		return parsed.String(), true
	case "query":
		text, isText := value.(string)
		text = strings.TrimSpace(text)
		if !isText || text == "" || !utf8.ValidString(text) {
			return nil, false
		}
		if utf8.RuneCountInString(text) > maximumInteractionQueryLength {
			text = string([]rune(text)[:maximumInteractionQueryLength])
		}
		return text, true
	case "surface":
		text, isText := value.(string)
		return text, isText && interactionSurfacePattern.MatchString(text)
	case "position", "resultCount":
		number, isNumber := value.(float64)
		if !isNumber || number != math.Trunc(number) || number < 0 || number > interactionIntegerBounds[key] {
			return nil, false
		}
		return int(number), true
	}
	return nil, false
}

func ResolveInteractionStore(ctx context.Context, tx *ent.Tx, data map[string]any) error {
	if rawProduct, found := data["productId"].(string); found {
		productId, _ := uuid.Parse(rawProduct)
		parent, err := tx.Product.Get(ctx, productId)
		if ent.IsNotFound(err) {
			delete(data, "productId")
			delete(data, "storeId")
			return nil
		}
		if err != nil {
			return err
		}
		data["storeId"] = parent.StoreID.String()
		return nil
	}
	rawStore, found := data["storeId"].(string)
	if !found {
		return nil
	}
	storeId, _ := uuid.Parse(rawStore)
	exists, err := tx.Store.Query().Where(store.ID(storeId)).Exist(ctx)
	if err != nil {
		return err
	}
	if !exists {
		delete(data, "storeId")
	}
	return nil
}

func InteractionDedupeKey(event string, data map[string]any) string {
	parts := []string{event}
	for _, key := range []string{"productId", "storeId", "categoryId", "variantId", "query"} {
		text, _ := data[key].(string)
		parts = append(parts, text)
	}
	return strings.Join(parts, "|")
}

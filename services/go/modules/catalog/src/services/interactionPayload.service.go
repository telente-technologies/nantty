package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/store"
)

const maximumInteractionQueryLength = 200

var interactionSurfacePattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,40}$`)

const intelligenceIdentifierHashLabel = "nantty:intelligence:user-id-hash"

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

func HashSearchQuery(query, idHashSecret, sharedSecret string) string {
	key := []byte(idHashSecret)
	if len(key) == 0 {
		derivation := hmac.New(sha256.New, []byte(sharedSecret))
		derivation.Write([]byte(intelligenceIdentifierHashLabel))
		key = derivation.Sum(nil)
	}
	normalized := strings.ToLower(strings.Join(strings.Fields(norm.NFKC.String(query)), " "))
	digest := hmac.New(sha256.New, key)
	digest.Write([]byte("query:" + normalized))
	return "q_" + hex.EncodeToString(digest.Sum(nil))[:40]
}

// HashIntelligenceUserId creates the same stable pseudonymous viewer key used by
// catalog-to-intelligence requests. Interaction outbox events use this value so
// the feature store and recommendation reads address the same viewer without
// exporting a raw account identifier.
func HashIntelligenceUserId(userId, idHashSecret, sharedSecret string) string {
	key := []byte(idHashSecret)
	if len(key) == 0 {
		derivation := hmac.New(sha256.New, []byte(sharedSecret))
		derivation.Write([]byte(intelligenceIdentifierHashLabel))
		key = derivation.Sum(nil)
	}
	digest := hmac.New(sha256.New, key)
	digest.Write([]byte("user:" + userId))
	return "u_" + hex.EncodeToString(digest.Sum(nil))[:40]
}

// IntelligenceInteractionPayload preserves the catalog's raw actor id for
// in-transaction store analytics while publishing only the stable pseudonym
// shared with the online recommendation feature store.
func IntelligenceInteractionPayload(data map[string]any, idHashSecret, sharedSecret string) map[string]any {
	payload := make(map[string]any, len(data))
	for key, value := range data {
		payload[key] = value
	}
	if actorId, found := data["actorId"].(string); found && actorId != "" {
		payload["actorId"] = HashIntelligenceUserId(actorId, idHashSecret, sharedSecret)
	}
	return payload
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
	for _, key := range []string{"productId", "storeId", "categoryId", "variantId", "queryHash", "query"} {
		text, _ := data[key].(string)
		parts = append(parts, text)
	}
	return strings.Join(parts, "|")
}

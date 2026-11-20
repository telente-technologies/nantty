package generatebarcodes

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strconv"
	"strings"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent/productvariant"
)

const maxGeneratedBarcodesPerRequest = 100

type Handler struct {
	Container *container.Container
}

func BuildInternalEan13(randomElevenDigits string) string {
	body := "2" + randomElevenDigits
	sum := 0
	for index := 0; index < 12; index++ {
		digit := int(body[index] - '0')
		if index%2 == 1 {
			digit *= 3
		}
		sum += digit
	}
	return body + strconv.Itoa((10-sum%10)%10)
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]string, error) {
	count := query.Count
	if count <= 0 || count > maxGeneratedBarcodesPerRequest {
		return nil, errors.New("barcode count must be between 1 and 100")
	}
	barcodes := make([]string, 0, count)
	seen := map[string]bool{}
	for len(barcodes) < count {
		digits, err := rand.Int(rand.Reader, big.NewInt(100_000_000_000))
		if err != nil {
			return nil, err
		}
		candidate := BuildInternalEan13(leftPad(digits.String(), 11))
		if seen[candidate] {
			continue
		}
		taken, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(query.StoreId), productvariant.Barcode(candidate)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if !taken {
			seen[candidate] = true
			barcodes = append(barcodes, candidate)
		}
	}
	return barcodes, nil
}

func leftPad(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return strings.Repeat("0", width-len(value)) + value
}

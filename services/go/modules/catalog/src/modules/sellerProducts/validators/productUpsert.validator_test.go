package validators

import (
	"testing"
	"time"

	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
)

func validRequest() dtos.ProductUpsertRequest {
	return dtos.ProductUpsertRequest{
		Name: "Ankara shirt", Status: "active", Options: []dtos.OptionRequest{{Name: "Size", Values: []string{"S", "M"}}},
		Variants: []dtos.VariantRequest{
			{OptionValues: map[string]string{"Size": "S"}, Sku: "SHIRT-S", PriceMinor: 500000, LowStockThreshold: 5},
			{OptionValues: map[string]string{"Size": "M"}, Sku: "SHIRT-M", PriceMinor: 500000, LowStockThreshold: 5},
		},
	}
}

func TestValidProductPasses(t *testing.T) {
	if err := ValidateProductUpsertAt(validRequest(), time.Now()); err != nil {
		t.Fatalf("expected valid product, got %v", err)
	}
}

func TestProductValidationRejectsBrokenVariants(t *testing.T) {
	cases := map[string]func(*dtos.ProductUpsertRequest){
		"duplicate sku case-insensitive": func(request *dtos.ProductUpsertRequest) { request.Variants[1].Sku = "shirt-s" },
		"duplicate combination":          func(request *dtos.ProductUpsertRequest) { request.Variants[1].OptionValues["Size"] = "S" },
		"missing option value":           func(request *dtos.ProductUpsertRequest) { request.Variants[0].OptionValues = map[string]string{} },
		"bad EAN-13 check digit": func(request *dtos.ProductUpsertRequest) {
			barcode := "2000000000001"
			request.Variants[0].Barcode = &barcode
		},
		"compare at below price": func(request *dtos.ProductUpsertRequest) {
			compare := int64(100)
			request.Variants[0].CompareAtPriceMinor = &compare
		},
		"publishAt on active": func(request *dtos.ProductUpsertRequest) { at := time.Now().Add(time.Hour); request.PublishAt = &at },
		"no variants":         func(request *dtos.ProductUpsertRequest) { request.Variants = nil },
		"http video": func(request *dtos.ProductUpsertRequest) {
			request.Videos = &[]dtos.VideoRequest{{Url: "http://x.test/v"}}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			request := validRequest()
			mutate(&request)
			if err := ValidateProductUpsertAt(request, time.Now()); err == nil {
				t.Fatal("expected a validation error")
			}
		})
	}
}

func TestEan13CheckDigit(t *testing.T) {
	if !IsValidEan13("4006381333931") {
		t.Fatal("known valid EAN-13 rejected")
	}
	if IsValidEan13("4006381333932") {
		t.Fatal("wrong check digit accepted")
	}
}

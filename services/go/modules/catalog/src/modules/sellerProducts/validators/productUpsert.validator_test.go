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

func TestValidProductParcelFieldsPass(t *testing.T) {
	request := validRequest()
	request.WeightGrams = intPointer(500)
	request.LengthMm = intPointer(300)
	request.WidthMm = intPointer(200)
	request.HeightMm = intPointer(100)
	request.PackageCategory = stringPointer("apparel")
	request.PackageCount = intPointer(1)
	request.Fragile = boolPointer(true)
	request.ContentsDescription = stringPointer("one folded shirt")
	request.DeclaredValueMinor = int64Pointer(500_000)
	request.Variants[0].WeightGrams = intPointer(250)
	request.Variants[0].LengthMm = intPointer(300)
	request.Variants[0].WidthMm = intPointer(200)
	request.Variants[0].HeightMm = intPointer(50)
	if err := ValidateProductUpsertAt(request, time.Now()); err != nil {
		t.Fatalf("expected valid parcel fields, got %v", err)
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
		"partial dimensions": func(request *dtos.ProductUpsertRequest) {
			request.WeightGrams = intPointer(500)
			request.LengthMm = intPointer(300)
		},
		"zero weight": func(request *dtos.ProductUpsertRequest) {
			request.WeightGrams = intPointer(0)
		},
		"zero package count": func(request *dtos.ProductUpsertRequest) {
			request.PackageCount = intPointer(0)
		},
		"invalid variant dimension": func(request *dtos.ProductUpsertRequest) {
			request.Variants[0].LengthMm = intPointer(0)
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

func intPointer(value int) *int { return &value }

func int64Pointer(value int64) *int64 { return &value }

func stringPointer(value string) *string { return &value }

func boolPointer(value bool) *bool { return &value }

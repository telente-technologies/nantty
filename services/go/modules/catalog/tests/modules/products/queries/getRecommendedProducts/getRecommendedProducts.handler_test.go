package getrecommendedproducts_test

import (
	"reflect"
	"testing"

	"nantty/modules/catalog/src/modules/products/queries/getRecommendedProducts"
)

func TestRecommendationTopicsAreUniqueBoundedSlugs(t *testing.T) {
	got := getrecommendedproducts.NormalizeRecommendationTopics([]string{"Home Decor", "home decor", "#seasonal", "", "summer_style"})
	want := []string{"home_decor", "summer_style"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("recommendation topics = %v, want %v", got, want)
	}
}

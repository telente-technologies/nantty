package getrecommendedproducts

import (
	"reflect"
	"testing"
)

func TestRecommendationTopicsAreUniqueBoundedSlugs(t *testing.T) {
	got := recommendationTopics([]string{"Home Decor", "home decor", "#seasonal", "", "summer_style"})
	want := []string{"home_decor", "summer_style"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("recommendation topics = %v, want %v", got, want)
	}
}

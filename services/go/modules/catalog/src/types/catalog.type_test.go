package types

import (
	"encoding/json"
	"testing"
)

func TestProductStoreSummaryIncludesViewerFollowState(t *testing.T) {
	payload, err := json.Marshal(ProductDetailView{Store: ProductStoreSummaryView{
		StoreSummaryView: StoreSummaryView{Id: "store-id", Name: "Ada Fabrics"},
		IsFollowing:      true,
	}})
	if err != nil {
		t.Fatalf("marshal product detail: %v", err)
	}

	var decoded struct {
		Store struct {
			IsFollowing bool `json:"isFollowing"`
		} `json:"store"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal product detail: %v", err)
	}
	if !decoded.Store.IsFollowing {
		t.Fatalf("expected product store follow state in response: %s", payload)
	}
}

func TestProductDetailIncludesProductAttributes(t *testing.T) {
	payload, err := json.Marshal(ProductDetailView{Attributes: []AttributeView{{Name: "Material", Value: "Cotton"}}})
	if err != nil {
		t.Fatalf("marshal product detail: %v", err)
	}

	var decoded struct {
		Attributes []AttributeView `json:"attributes"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal product detail: %v", err)
	}
	if len(decoded.Attributes) != 1 || decoded.Attributes[0].Name != "Material" || decoded.Attributes[0].Value != "Cotton" {
		t.Fatalf("expected product attributes in buyer response, got %s", payload)
	}
}

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

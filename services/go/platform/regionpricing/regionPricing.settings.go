package regionpricing

import (
	"encoding/json"
	"fmt"
)

const SettingKey = "regional-pricing"

type SettingDocument struct {
	Ads                      []AdRegionPricing                    `json:"ads"`
	CreatorSubscriptionBands map[string][]CreatorSubscriptionBand `json:"creatorSubscriptionBands"`
}

func DefaultSettingDocument() SettingDocument {
	bands := map[string][]CreatorSubscriptionBand{}
	for _, region := range supportedRegions {
		bands[region.Code] = DefaultCreatorSubscriptionBands(region.Code)
	}
	return SettingDocument{Ads: DefaultAdRegionPricing(), CreatorSubscriptionBands: bands}
}

// ParseSettingDocument reads the admin document and fills any region it leaves out with the research defaults.
func ParseSettingDocument(raw json.RawMessage, found bool) SettingDocument {
	document := DefaultSettingDocument()
	if !found || len(raw) == 0 {
		return document
	}
	var stored SettingDocument
	if json.Unmarshal(raw, &stored) != nil || ValidateSettingDocument(stored) != nil {
		return document
	}
	for _, row := range stored.Ads {
		for index := range document.Ads {
			if document.Ads[index].Region == row.Region {
				document.Ads[index] = row
			}
		}
	}
	for region, bands := range stored.CreatorSubscriptionBands {
		if len(bands) > 0 {
			document.CreatorSubscriptionBands[region] = bands
		}
	}
	return document
}

func ValidateSettingDocument(document SettingDocument) error {
	for index, row := range document.Ads {
		region, known := FindRegion(row.Region)
		switch {
		case !known:
			return fmt.Errorf("ads[%d].region must be one of NG, GH, KE, ZA, GB, EU, US", index)
		case row.Currency != region.Currency:
			return fmt.Errorf("ads[%d].currency must be %s", index, region.Currency)
		case row.CpmFloorMinor <= 0 || row.CpcFloorMinor <= 0 || row.MinimumDailyBudgetMinor <= 0 || row.BoostMinimumDailyMinor <= 0:
			return fmt.Errorf("ads[%d] floors and minimum budgets must be above zero", index)
		case row.CpcFloorMinor > row.MinimumDailyBudgetMinor:
			return fmt.Errorf("ads[%d].cpcFloorMinor can't exceed the minimum daily budget", index)
		}
	}
	for region, bands := range document.CreatorSubscriptionBands {
		if _, known := FindRegion(region); !known {
			return fmt.Errorf("creatorSubscriptionBands.%s is not a pricing region", region)
		}
		previous := int64(0)
		for index, band := range bands {
			if band.Band == "" || band.WebMinor <= previous || band.AppMinor < band.WebMinor {
				return fmt.Errorf("creatorSubscriptionBands.%s[%d] must be named, rise band by band, and cost at least as much in the app as on the web", region, index)
			}
			previous = band.WebMinor
		}
	}
	return nil
}

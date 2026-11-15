package scheduledReports_test

import (
	"testing"

	"nantty/modules/ads/src/modules/reporting/dtos"
	"nantty/modules/ads/src/modules/reporting/validators"
)

func valid() dtos.ScheduledReportInput {
	return dtos.ScheduledReportInput{Name: " Weekly ", Recipients: []string{"Ada@Example.com", "ada@example.com"}, Frequency: "weekly", Breakdown: "campaign", Metrics: []string{"spend", "clicks"}}
}

func TestScheduledReportNormalisesRecipients(t *testing.T) {
	input, err := validators.ValidateScheduledReport(valid())
	if err != nil || input.Name != "Weekly" || len(input.Recipients) != 1 || input.Recipients[0] != "ada@example.com" {
		t.Fatalf("unexpected %+v %v", input, err)
	}
}

func TestScheduledReportRejectsBadInput(t *testing.T) {
	cases := map[string]func(*dtos.ScheduledReportInput){
		"no recipients": func(input *dtos.ScheduledReportInput) { input.Recipients = nil },
		"display name":  func(input *dtos.ScheduledReportInput) { input.Recipients = []string{"Ada <ada@example.com>"} },
		"eleven": func(input *dtos.ScheduledReportInput) {
			input.Recipients = nil
			for i := 0; i < 11; i++ {
				input.Recipients = append(input.Recipients, string(rune('a'+i))+"@example.com")
			}
		},
		"bad frequency":  func(input *dtos.ScheduledReportInput) { input.Frequency = "hourly" },
		"unknown metric": func(input *dtos.ScheduledReportInput) { input.Metrics = []string{"secret"} },
		"unknown cut":    func(input *dtos.ScheduledReportInput) { input.Breakdown = "email" },
	}
	for name, mutate := range cases {
		input := valid()
		mutate(&input)
		if _, err := validators.ValidateScheduledReport(input); err == nil {
			t.Fatalf("%s must be rejected", name)
		}
	}
}

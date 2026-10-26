package dtos

import "nantty/modules/ads/src/types"

type ConversionEvent struct {
	Id             string  `json:"id"`
	Name           string  `json:"name"`
	EventType      string  `json:"eventType"`
	StoreId        string  `json:"storeId"`
	StoreName      string  `json:"storeName"`
	IsBuiltIn      bool    `json:"isBuiltIn"`
	Status         string  `json:"status"`
	LastReceivedAt *string `json:"lastReceivedAt"`
	CountLast7Days int64   `json:"countLast7Days"`
	TracksValue    bool    `json:"tracksValue"`
}

type ConversionEventInput struct {
	Name        string `json:"name"`
	EventType   string `json:"eventType"`
	StoreId     string `json:"storeId"`
	TracksValue bool   `json:"tracksValue"`
}

type ConversionEventPatch struct {
	Name   *string `json:"name"`
	Status *string `json:"status"`
}

type ExperimentArm struct {
	AdSetId        string `json:"adSetId"`
	AdSetName      string `json:"adSetName"`
	TrafficPercent int    `json:"trafficPercent"`
	Note           string `json:"note"`
}

type Experiment struct {
	Id           string                  `json:"id"`
	Name         string                  `json:"name"`
	CampaignId   string                  `json:"campaignId"`
	CampaignName string                  `json:"campaignName"`
	Variable     string                  `json:"variable"`
	Metric       string                  `json:"metric"`
	Status       string                  `json:"status"`
	Arms         []ExperimentArm         `json:"arms"`
	StartAt      string                  `json:"startAt"`
	EndAt        string                  `json:"endAt"`
	Result       *types.ExperimentResult `json:"result"`
	CreatedAt    string                  `json:"createdAt"`
}

type ExperimentInput struct {
	Name       string                `json:"name"`
	CampaignId string                `json:"campaignId"`
	Variable   string                `json:"variable"`
	Metric     string                `json:"metric"`
	Arms       []types.ExperimentArm `json:"arms"`
	StartAt    string                `json:"startAt"`
	EndAt      string                `json:"endAt"`
}

type RuleAction struct {
	Type    string `json:"type"`
	Percent *int   `json:"percent"`
}

type AutomatedRule struct {
	Id                string                `json:"id"`
	Name              string                `json:"name"`
	Status            string                `json:"status"`
	Level             string                `json:"level"`
	TargetIds         []string              `json:"targetIds"`
	Conditions        []types.RuleCondition `json:"conditions"`
	Action            RuleAction            `json:"action"`
	CheckEveryMinutes int                   `json:"checkEveryMinutes"`
	LastRunAt         *string               `json:"lastRunAt"`
	LastTriggeredAt   *string               `json:"lastTriggeredAt"`
	TriggerCount      int                   `json:"triggerCount"`
	CreatedAt         string                `json:"createdAt"`
}

type AutomatedRuleInput struct {
	Name              string                `json:"name"`
	Level             string                `json:"level"`
	TargetIds         []string              `json:"targetIds"`
	Conditions        []types.RuleCondition `json:"conditions"`
	Action            RuleAction            `json:"action"`
	CheckEveryMinutes int                   `json:"checkEveryMinutes"`
}

type AutomatedRulePatch struct {
	Name              *string                `json:"name"`
	Level             *string                `json:"level"`
	TargetIds         *[]string              `json:"targetIds"`
	Conditions        *[]types.RuleCondition `json:"conditions"`
	Action            *RuleAction            `json:"action"`
	CheckEveryMinutes *int                   `json:"checkEveryMinutes"`
	Status            *string                `json:"status"`
}

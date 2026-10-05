package services

import "zudomart/modules/ads/src/types"

type Behaviour struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var Behaviours = []Behaviour{
	{Id: "beh_recent_buyers", Name: "Bought on Zudomart in the last 30 days", Description: "People with at least one completed order."},
	{Id: "beh_frequent_buyers", Name: "Frequent buyers", Description: "Three or more orders in the last 90 days."},
	{Id: "beh_live_shoppers", Name: "Live shopping viewers", Description: "Watched a live shopping session in the last 30 days."},
	{Id: "beh_cart_abandoners", Name: "Left items in cart", Description: "Added to cart but did not check out in the last 14 days."},
	{Id: "beh_clip_watchers", Name: "Heavy reel watchers", Description: "Watch reels most days."},
	{Id: "beh_new_users", Name: "New to Zudomart", Description: "Joined in the last 30 days."},
	{Id: "beh_pay_on_delivery", Name: "Prefers pay on delivery", Description: "Chooses pay on delivery at checkout."},
	{Id: "beh_android_budget", Name: "Uses an entry-level Android phone", Description: "Useful for lighter creatives and data-friendly reels."},
}

func country(code, name string) types.LocationTarget {
	return types.LocationTarget{Type: "country", Code: code, Name: name, CountryCode: code}
}

func state(code, name, countryCode, countryName string) types.LocationTarget {
	parent := countryName
	return types.LocationTarget{Type: "state", Code: code, Name: name, CountryCode: countryCode, ParentName: &parent}
}

func city(code, name, countryCode, parentName string) types.LocationTarget {
	parent := parentName
	return types.LocationTarget{Type: "city", Code: code, Name: name, CountryCode: countryCode, ParentName: &parent}
}

func nigerianState(code, name string) types.LocationTarget {
	return state("NG-"+code, name, "NG", "Nigeria")
}

var Locations = []types.LocationTarget{
	country("NG", "Nigeria"), country("GH", "Ghana"), country("KE", "Kenya"), country("ZA", "South Africa"), country("GB", "United Kingdom"), country("US", "United States"),
	nigerianState("LA", "Lagos"), nigerianState("FC", "Federal Capital Territory"), nigerianState("RI", "Rivers"), nigerianState("OY", "Oyo"), nigerianState("KN", "Kano"),
	nigerianState("EN", "Enugu"), nigerianState("AB", "Abia"), nigerianState("OG", "Ogun"), nigerianState("ED", "Edo"), nigerianState("KD", "Kaduna"),
	nigerianState("AN", "Anambra"), nigerianState("DE", "Delta"), nigerianState("KW", "Kwara"), nigerianState("PL", "Plateau"), nigerianState("AD", "Adamawa"),
	nigerianState("AK", "Akwa Ibom"), nigerianState("BA", "Bauchi"), nigerianState("BY", "Bayelsa"), nigerianState("BE", "Benue"), nigerianState("BO", "Borno"),
	nigerianState("CR", "Cross River"), nigerianState("EB", "Ebonyi"), nigerianState("EK", "Ekiti"), nigerianState("GO", "Gombe"), nigerianState("IM", "Imo"),
	nigerianState("JI", "Jigawa"), nigerianState("KT", "Katsina"), nigerianState("KE", "Kebbi"), nigerianState("KO", "Kogi"), nigerianState("NA", "Nasarawa"),
	nigerianState("NI", "Niger"), nigerianState("ON", "Ondo"), nigerianState("OS", "Osun"), nigerianState("SO", "Sokoto"), nigerianState("TA", "Taraba"),
	nigerianState("YO", "Yobe"), nigerianState("ZA", "Zamfara"),
	state("GH-AA", "Greater Accra", "GH", "Ghana"), state("GH-AH", "Ashanti", "GH", "Ghana"), state("KE-30", "Nairobi County", "KE", "Kenya"),
	city("NG-LA-IKJ", "Ikeja", "NG", "Lagos, Nigeria"), city("NG-LA-LEK", "Lekki", "NG", "Lagos, Nigeria"), city("NG-LA-YAB", "Yaba", "NG", "Lagos, Nigeria"),
	city("NG-LA-SUR", "Surulere", "NG", "Lagos, Nigeria"), city("NG-FC-ABJ", "Abuja", "NG", "Federal Capital Territory, Nigeria"),
	city("NG-RI-PHC", "Port Harcourt", "NG", "Rivers, Nigeria"), city("NG-OY-IBA", "Ibadan", "NG", "Oyo, Nigeria"), city("NG-AB-ABA", "Aba", "NG", "Abia, Nigeria"),
	city("NG-EN-ENU", "Enugu", "NG", "Enugu, Nigeria"), city("NG-KN-KAN", "Kano", "NG", "Kano, Nigeria"), city("NG-ED-BEN", "Benin City", "NG", "Edo, Nigeria"),
	city("GH-AA-ACC", "Accra", "GH", "Greater Accra, Ghana"), city("GH-AH-KUM", "Kumasi", "GH", "Ashanti, Ghana"), city("KE-30-NBO", "Nairobi", "KE", "Nairobi County, Kenya"),
}

func IsKnownBehaviour(id string) bool {
	for _, behaviour := range Behaviours {
		if behaviour.Id == id {
			return true
		}
	}
	return false
}

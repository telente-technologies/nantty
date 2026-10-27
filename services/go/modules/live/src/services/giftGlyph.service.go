package services

var giftGlyphsById = map[string]string{
	"gift_like": "👍", "gift_clap": "👏", "gift_fire": "🔥", "gift_heart": "❤️", "gift_star": "⭐", "gift_thumbs_up": "👍", "gift_smile": "😊",
	"gift_sparkle": "✨", "gift_rose": "🌹", "gift_gift_box": "🎁", "gift_crown": "👑", "gift_diamond": "💎", "gift_rocket": "🚀",
	"gift_lightning": "⚡", "gift_fireworks": "🎆", "gift_money_rain": "💸", "gift_golden_crown": "👑", "gift_luxury_car": "🏎️",
	"gift_private_jet": "✈️", "gift_treasure_chest": "🧰", "gift_diamond_shower": "💎", "gift_golden_rain": "🌟", "gift_supernova": "🌠",
	"gift_nantty_galaxy": "🌌", "gift_nantty_king": "🤴", "gift_nantty_empire": "🏰",
}

func giftGlyph(giftId string) string {
	if glyph, known := giftGlyphsById[giftId]; known {
		return glyph
	}
	return "🎁"
}

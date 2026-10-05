package ipallowlist

import (
	"net/netip"
	"strings"
)

const MaximumEntries = 50

func ParseEntry(raw string) (netip.Prefix, bool) {
	entry := strings.TrimSpace(raw)
	if entry == "" {
		return netip.Prefix{}, false
	}
	if strings.Contains(entry, "/") {
		prefix, err := netip.ParsePrefix(entry)
		if err != nil || prefix.Addr().Zone() != "" {
			return netip.Prefix{}, false
		}
		return prefix.Masked(), true
	}
	address, err := netip.ParseAddr(entry)
	if err != nil || address.Zone() != "" {
		return netip.Prefix{}, false
	}
	address = address.Unmap()
	return netip.PrefixFrom(address, address.BitLen()), true
}

func NormalizeEntries(entries []string) ([]string, bool) {
	normalized := make([]string, 0, len(entries))
	seen := map[string]bool{}
	for _, entry := range entries {
		prefix, valid := ParseEntry(entry)
		if !valid {
			return nil, false
		}
		text := prefix.String()
		if !seen[text] {
			seen[text] = true
			normalized = append(normalized, text)
		}
	}
	return normalized, true
}

func IsAddressAllowed(clientAddress string, entries []string) bool {
	if len(entries) == 0 {
		return true
	}
	address, err := netip.ParseAddr(strings.TrimSpace(clientAddress))
	if err != nil {
		return false
	}
	address = address.Unmap().WithZone("")
	for _, entry := range entries {
		prefix, valid := ParseEntry(entry)
		if valid && prefix.Contains(address) {
			return true
		}
	}
	return false
}

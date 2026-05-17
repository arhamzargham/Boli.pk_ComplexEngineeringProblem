package vetting

import "testing"

func TestLuhnCheck(t *testing.T) {
	tests := []struct {
		imei  string
		valid bool
		desc  string
	}{
		{"490154203237518", true,  "valid IMEI"},
		{"490154203237519", false, "invalid checksum"},
		{"12345678901234",  false, "too short (14 digits)"},
		{"1234567890123456", false, "too long (16 digits)"},
		{"",                false, "empty string"},
		{"ABCDEFGHIJKLMNO", false, "non-numeric"},
		{"353879234252864", true,  "real Samsung IMEI"},
		{"012345678901237", true,  "valid checksum"},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			result := LuhnCheck(tt.imei)
			if result != tt.valid {
				t.Errorf("LuhnCheck(%q) = %v, want %v", tt.imei, result, tt.valid)
			}
		})
	}
}

package vetting

// LuhnCheck validates an IMEI using the Luhn algorithm (ISO/IEC 7812).
// Returns true only for a valid 15-digit numeric string.
func LuhnCheck(imei string) bool {
	if len(imei) != 15 {
		return false
	}
	var sum int
	for i, ch := range imei {
		if ch < '0' || ch > '9' {
			return false
		}
		d := int(ch - '0')
		// Double every second digit from the right (0-indexed: odd positions from left)
		if (15-i)%2 == 0 {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
	}
	return sum%10 == 0
}

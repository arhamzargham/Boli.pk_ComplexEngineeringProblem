package sms

import "os"

// NewProvider returns the configured SMS provider based on the SMS_PROVIDER env var.
func NewProvider() Provider {
	if os.Getenv("SMS_PROVIDER") == "twilio" {
		return NewTwilioProvider()
	}
	return NewMockProvider()
}

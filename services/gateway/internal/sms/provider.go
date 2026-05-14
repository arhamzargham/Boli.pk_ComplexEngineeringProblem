package sms

import "context"

// Provider defines the abstraction layer for sending SMS messages.
type Provider interface {
	Send(ctx context.Context, phone string, message string) error
}

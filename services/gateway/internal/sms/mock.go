package sms

import (
	"context"
	"fmt"
)

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (m *MockProvider) Send(ctx context.Context, phone string, message string) error {
	fmt.Printf("[MOCK SMS] To: %s | Message: %s\n", phone, message)
	return nil
}

package sms

import (
	"context"
	"fmt"
	"os"

	"github.com/twilio/twilio-go"
	openapi "github.com/twilio/twilio-go/rest/api/v2010"
)

type TwilioProvider struct {
	client     *twilio.RestClient
	fromNumber string
}

func NewTwilioProvider() *TwilioProvider {
	// Relies on TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars
	return &TwilioProvider{
		client:     twilio.NewRestClient(),
		fromNumber: os.Getenv("TWILIO_FROM_NUMBER"),
	}
}

func (t *TwilioProvider) Send(ctx context.Context, phone string, message string) error {
	params := &openapi.CreateMessageParams{}
	params.SetTo(phone)
	params.SetFrom(t.fromNumber)
	params.SetBody(message)

	_, err := t.client.Api.CreateMessage(params)
	if err != nil {
		return fmt.Errorf("twilio send error: %w", err)
	}

	return nil
}

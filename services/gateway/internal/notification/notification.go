package notification

// Notification dispatch: PUSH (FCM/APNs mocked), IN_APP (Centrifugo), SMS (Twilio mocked).
// 7 subclasses: Bid, Meetup, IMEI, Settlement, Governance, AdminAlert, VettingComplete.
// Retry: max 3 attempts with exponential backoff (30s, 2min, 10min).
// See CLAUDE.md Section 6 (Package 7).

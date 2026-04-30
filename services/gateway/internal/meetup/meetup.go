package meetup

// Meetup coordination: location confirmation, IMEI scan, QR unlock gate.
// INVARIANT: IF imeiScanResult = MISMATCH THEN qrScannedAt MUST be NULL.
// DIRBS re-check fires at IMEI scan time (not just at listing creation).
// See CLAUDE.md Section 6 (Package 5, MeetupSession).

package main

// Admin bootstrap CLI.
// Usage:
//   go run ./cmd/bootstrap --create-superadmin --email=admin1@boli.pk --secret=$BOOTSTRAP_SECRET
//   go run ./cmd/bootstrap --revoke-superadmin  --email=admin1@boli.pk --secret=$BOOTSTRAP_SECRET
//
// BOOTSTRAP_SECRET is a one-time environment variable, rotated and destroyed after setup.
// See CLAUDE.md Section 6 (Admin Bootstrap Problem / Gap 30) for full protocol.

func main() {
	// TODO: parse --create-superadmin / --revoke-superadmin flags
	// TODO: validate BOOTSTRAP_SECRET against environment
	// TODO: connect to PostgreSQL
	// TODO: execute bootstrap action inside a transaction
}

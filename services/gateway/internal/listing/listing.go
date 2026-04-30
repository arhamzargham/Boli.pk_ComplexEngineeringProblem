package listing

// Listing CRUD, vetting trigger, status transitions.
// Max 5 active listings per seller (configurable constant, not hardcoded).
// Triggers AI vetting pipeline on create; routes result to badge assignment.
// See CLAUDE.md Section 6 (Package 2).

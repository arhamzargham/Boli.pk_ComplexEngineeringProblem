package admin

// Admin portal: Maker-Checker approval workflow, dispute resolution, wallet adjustment.
// INVARIANT: initiatorId != approverId — enforced at app layer AND DB constraint.
// Subclasses: ManualRefundApproval, DisputeResolutionApproval, PenaltyOverrideApproval,
//             AccountActionApproval, WalletAdjustmentApproval.
// See CLAUDE.md Section 6 (Package 6, AdminApproval).

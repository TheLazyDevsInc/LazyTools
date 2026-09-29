# ADR-0001: Retry failed payments automatically, up to 3 times

**Status:** Accepted
**Date:** 2026-10-09 (answers collected 2026-10-06 to 2026-10-08)
**Deciders:** Sam (Product Manager, via question page artifact)

## Context

ACME Billing processes invoices and payments for enterprise clients. Payment failures from temporary issues (network timeouts, rate limits) often resolve within hours. Issue #41 tracked retry strategy decision; issue #42 requested recurring invoice support.

The retry decision was critical for the payment reliability roadmap. Recurring invoices require further discussion.

## Decision

| Q | Question | Answer | Source |
|---|---|---|---|
| Q1a (#41) | Enable auto-retry? | Yes, retry automatically. | **Answered** by Sam, 7 Oct 2026 |
| Q1b (#41) | How many times? | Retry up to 3 times. | **Answered** by Sam, 7 Oct 2026 |
| Q2a (#42) | Recurring invoice priority? | Not decided. | **Unanswered** at deadline. |

## Options considered

### Q1a options
- **A. Auto-retry:** Automatically retry failed transactions. Reduces customer-facing failures.
- **B. Manual retry only:** Notify customer and require manual action to retry.

### Q1b options
- **3 times (chosen):** Retry up to 3 times.
- **Once:** Retry only once. No reason given in the answer.
- **5 times:** Retry up to 5 times. No reason given in the answer.

## Trade-off analysis

Auto-retry increases API calls to the payment processor. Cost impact not measured yet. The benefit is faster payment resolution and fewer support escalations.

## Consequences

- **Users see:** Automatic retry of failed payments. Failure notifications show retry status.
- **Data:** Add `retry_count` and `last_retry_at` columns to the `payments` table (#41).
- **Access:** No permission changes needed. Finance team views retry history on invoice details page.
- **Follow-ups:** Show retry status on invoice page (#43). Track retry success rate (#44).

## Action items

- [ ] Engineering: Create migration for payment retry tracking (#41)
- [ ] Engineering: Show retry status on invoice page (#43)
- [ ] Engineering: Track retry success rate (#44)
- [ ] Sam: Answer Q2a, recurring invoice priority (#42)

## Record

- Raw answers: Read from the artifact `answers` collection on 9 Oct 2026; not saved.
- Open questions left unanswered: Q2a (#42), recurring invoice priority. No default. Waiting for Sam.

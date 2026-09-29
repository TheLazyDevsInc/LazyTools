# ADR-0001: Lock saved answers and log every change per person

**Status:** Accepted
**Date:** 2026-09-29 (answers collected 29 Sep 2026, 15:01 to 15:02 IST)
**Deciders:** Vinay (decision owner, answered on the artifact)

## Context

The help-me-decide page saves an answer on every tap. A stray tap replaces a saved answer with no warning. The page keeps only the latest answer, so nobody can see who changed what, or when.

Vinay wants a saved answer to lock. A change must need a deliberate "Change answer" action. Every save and change must go into a log that names the signed-in person.

Teams share one page, so several people can save. The artifact `db` store (runtime contract 0.2.63) sets these limits:
- Access rules set only who may read and who may write a path. There is no append-only rule.
- The server does not stamp who wrote a document. The `by` field is written by the page.
- A path that ends in `{self}` lets each person write only under their own id. The server checks that id.

Out of scope: a log that nobody can edit. The `db` store cannot do this. It needs an outside service.

## Decision

A tap on an option saves it and locks the part. A change needs "Change answer", then "Save change". Each person logs their own actions at `audit/<their id>`, which the server checks. The ADR names people by name only.

Already decided before the page:
- Anyone who can save may answer. Each answer names the signed-in person. Vinay, 29 Sep 2026: "It shold know which signed in user answered".
- The ADR shows every change and who made it. Vinay, 29 Sep 2026: "Yes and also show by whom".

| Q | Question | Answer | Source |
|---|---|---|---|
| Q1 | How strong must the change log be? | Server-checked author. Each person writes only their own log at audit/<their id>. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q2 | How should the ADR name the person? | Name only. Add a short id if two people share a name. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q3a | What does the first tap on an option do? | Saves the answer and locks it at once. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q3b | After Change answer, how is the new answer saved? | The person picks, then presses Save change. Cancel locks it again. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q4 | Can a note be edited after the answer locks? | Only through Change answer. The edit is logged. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q5 | Who can see the change history on the page? | Everyone who can open the page. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |
| Q6 | What if a teammate saves while you change the same answer? | Stop your save and ask you to check the new answer first. | **Answered** by Vinay, 29 Sep 2026 15:01 IST |

Every answer matches the default Claude proposed. Vinay chose each one by hand. None came from the "Use the default" button.

## Options considered

### Q1: change log strength
- **Server-checked author (chosen).** Nobody can write an entry in a teammate's name. People can still edit their own entries.
- **One shared log (not chosen).** Simpler. A teammate could edit or delete other people's entries.
- **Tamper-proof through an outside service (not chosen).** For example, a GitHub comment per change. Much more work and a second system to run.

### Q2: naming people in the ADR
- **Name only (chosen).** Keeps the rule "never put emails in the ADR".
- **Name, plus email in a local file never committed (not chosen).**
- **Name and email in the ADR (not chosen).** An email in git history stays forever.

### Q3a, Q3b: lock and change
- **First tap saves and locks (chosen)** vs **select, then Save (not chosen).**
- **Change needs Save change (chosen)** vs **next tap saves (not chosen).**

### Q4: notes after lock
- **Only through Change answer, logged (chosen)** vs **any time, logged** vs **any time, not logged.**

### Q5: history on the page
- **Everyone who can open the page (chosen)** vs **only people who can save** vs **only in the ADR.**

### Q6: two people change one answer
- **Stop and ask to check (chosen)** vs **last save wins, both logged.**

## Trade-off analysis

- A first tap still saves at once. So an accidental first answer is possible, but it is logged and easy to change.
- A change takes two actions. This protects the risky action at the cost of one extra tap.
- People can edit their own log entries. We accept this for team decisions. The ADR says the log is "server-checked author", not "tamper-proof".
- The "someone else changed it" check compares a `rev` field before saving. Two saves in the same second can still race. The log keeps both.

## Consequences

- **Users see:** locked parts with "Saved by <name> · <time>", a Change answer button, and a History list per part.
- **Data:** new path `audit/<person id>`, one document per person with a list of events. `answers/<part id>` gains a `rev` field. Old pages with no `audit` keep working.
- **Access:** new rules. Everyone who can open the page reads `audit`. Each person writes only their own `audit/<id>`. Viewers and Commenters get no Change button.
- **Follow-ups:** none tracked yet. The build plan is in the design spec (no issue exists).

## Action items

- [ ] Vinay: review the design spec `docs/superpowers/specs/2026-09-29-answer-lock-audit-design.md`.
- [ ] Claude: check the access rules on a test page before building (spec, step 1).
- [ ] Claude: build, test and release as lazytools 0.3.0.

## Record

- Question page: https://claude.ai/artifact/MzTVJZ6rkth3JF6WwZQGwR (version 1)
- Raw answers: read from the artifact `answers` collection on 2026-09-29; not saved to a file (the table above has every field that matters).
- Open questions left unanswered: none.

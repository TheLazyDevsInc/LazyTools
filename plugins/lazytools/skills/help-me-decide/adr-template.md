# ADR-{{NNNN}}: {{Decision title, as a statement of what we decided}}

**Status:** {{Accepted | Accepted with defaults | Proposed | Superseded by ADR-XXXX}}
**Date:** {{YYYY-MM-DD}} (answers collected {{date range}})
**Deciders:** {{Name (role, how they answered: artifact / WhatsApp / issue comment)}} · {{...}}

## Context

{{What forced the decision. Two to four short paragraphs. Name the issues and PRs (#123). State
what is measured, not what is guessed. Say what is out of scope and why.}}

## Decision

{{One short paragraph, then a table or list of the actual choices. One row per question part.}}

| Q | Question | Answer | Source |
|---|---|---|---|
| Q1 (#123) | {{question}} | {{chosen option}} | **Answered** by {{name}}, {{date}} |
| Q2 (#124) | {{question}} | {{default option}} | **Default applied.** Not answered by {{deadline}}. |

Mark every row **Answered**, **Changed (N×)**, **Default applied** or **Unanswered**. Never present a default as a decision someone made.

## Changes

{{One line per change, in time order, from the page's change log. Name only, never email.}}

- Q1 (#123): '{{from}}' → '{{to}}', by {{name}}, {{date and time with timezone}}.
- {{or "No answer was changed." or "No change history recorded (page older than 0.3.0)."}}

## Options considered

### Option A: {{name}} {{(chosen | not chosen)}}
- What it is: {{...}}
- Why {{chosen | not chosen}}: {{...}}

### Option B: {{name}}
- ...

## Trade-off analysis

{{What we gave up. What each option costs in code, data, time or risk. Keep to facts.}}

## Consequences

- **Users see:** {{what changes for a person using the product}}
- **Data:** {{migrations, backfills, production writes and who approves them}}
- **Access:** {{roles and permissions touched}}
- **Follow-ups:** {{each with an issue number in the same sentence}}

## Action items

- [ ] {{Owner}}: {{action}} (#{{issue}})
- [ ] {{Owner}}: {{action}} (#{{issue}})

## Record

- Question page: {{artifact URL}}
- Raw answers: read from the artifact `answers` collection on {{date}}; saved to {{path or "not saved"}}.
- Change log: read from the artifact `audit` collection on {{date}}. {{Any answer marked "not in the log", or any `by` that differs from the log author, or "All answers match the log."}}
- Open questions left unanswered: {{list with issue numbers, or "none"}}

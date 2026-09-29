---
name: help-me-decide
description: Turn open product or engineering decisions into a multiple-choice Artifact that a decision owner answers, then read the answers back and write an ADR. Use when the user says "questions for <person>", "make this an MCQ", "collect decisions", or "turn the answers into an ADR".
---

# Help me decide: questions to ADR

Two phases. Phase 1 builds a multiple-choice page and publishes it as an Artifact. Phase 2 reads the saved answers and writes an ADR. Do not skip the checks in step 1: a question that was already answered wastes the owner's time and costs trust.

Requirements:
- Claude Code signed in to claude.ai, with the `Artifact` and `ArtifactData` tools, and the `artifact-design` and `artifact-capabilities` skills. The page saves answers with the artifact `db` capability. If these tools are missing, stop and tell the user. Do not fake the page with a static file: it could not collect answers.
- The decision owner can open the artifact and has Contributor or Editor access.

Files in this skill (read them from the skill folder):
- `template.html`: the page. Fill the placeholders and the `Q` array. Do not redesign it.
- `adr-template.md`: the ADR format. If the project already has a `docs/adr/` folder, copy its numbering, headings and tone instead, and use this file only where the project has no format.

## Step 0: Is this a real decision, and do you have the inputs?

Gate: a real decision has an owner, a cost if wrong, and a source (issue, chat or notes). If the question is personal, trivial or has no owner and no source (for example "vanilla or chocolate?"), stop. Say so, give the short answer if asked, and do not build a page or ADR unless the user says it is a test.

Intake: if the user gave no questions or sources, ask for four things before anything else: (1) the sources (issue numbers, chat export or notes file), (2) the decision owner and their timezone and locale, (3) the real deadline, (4) the tracker repo or "none". Do not invent any of them.

## Phase 1: build and publish the question page

1. **Find what is really open.** For every candidate question:
   - Read ALL comments on the issue. Read the whole thread, not the last comment.
   - Search the chat export or notes the user names, for the decision owner's own messages.
   - Check the decision notes, release notes and any doctrine or AGENTS.md "open, not decided" item.
   - Mark each candidate ANSWERED, PARTLY or UNANSWERED, with a short quote, a date and a place. Drop ANSWERED ones. Show them on the page as "Not asking. Already decided."
   - A question the owner cannot decide (it belongs to someone else) does not go on their page. Say who owns it.
   - Verify against the source yourself. Do not trust a helper agent's summary for this step.
2. **Write each question as a card.**
   - One plain question. One or two sentences of "why we ask now" (facts, dates, issue numbers).
   - 2 to 4 options. Put the option that is built if nobody answers first, with `d:1`. If no default is safe, set `nodef:1` and say so.
   - Split multi-part questions into parts, one choice each.
   - Use the owner's words and the product's real terms. Short sentences, one idea each.
   - Give each card its issue number as `#123`. The page links it. Use a plain label when no issue exists.
   - Group by urgency, for example "Needed for the release" (with the real deadline) and "Can wait".
3. **Fill the template.**
   - Replace `{{TITLE}}`, `{{EYEBROW}}`, `{{LEDE}}`, `{{ISSUE_BASE}}` (for example `https://github.com/OWNER/REPO/issues/`; use an empty string if there is no tracker), `{{DEADLINE}}`, `{{DECIDED_ROWS}}`, `{{SOURCE_LINE}}`.
   - Replace `{{TIMEZONE}}` (an IANA name such as `Asia/Kolkata` or `Europe/London`), `{{TZ_LABEL}}` (for example `IST`) and `{{LOCALE}}` (for example `en-IN` or `en-GB`) with the values the decision owner uses. They format the "Saved by … at …" line.
   - Replace the two example entries in `Q`. Keep part ids unique and made of letters and digits.
   - Check real dates with `date`. Never guess a weekday.
4. **Publish.** Run `node check.mjs <filled-page.html>` from the skill folder. Fix every failure before you publish. Before writing, load the `artifact-design` and `artifact-capabilities` skills. Publish with the Artifact tool and `capabilities: {"db": {"rules": [{"path": "audit", "read": "view", "write": "owner"}, {"path": "audit/{self}", "write": "interact"}]}, "user": {"scopes": ["profile"]}}`. The rules let everyone who can open the page read the change log, and let each person write only their own log. To change an existing page, read it first and pass its `url`. Answers save to the `answers` collection, one document per part id. Each save also adds one event to `audit/<person id>`.
5. **Tell the user how to share it.** The owner of the decisions must have Contributor or Editor access. With Viewer or Commenter access the page shows "You can read but not save".
6. **Check once.** Read the `answers` collection with `ArtifactData` (`action: list`). It should be empty. Ask the user to open the page. The count must read "0 of N answered", where N is the number of parts. "0 of 0" means the page script failed. Say what you could not test: a real tap needs a signed-in viewer.
7. **Send the link and the deadline** to the decision owner. If they do not use the tool, prepare a short message for the user to forward.

## Phase 2: read the answers and write the ADR

1. **Read the answers and the change log.** Use `ArtifactData` with `action: list` on `answers`, then on `audit`. Each `answers` document has: `n`, `part`, `choice`, `label`, `other`, `note`, `by`, `at`, `viaDefault`, `rev`. Each `audit` document id is a person id; its `events` list holds `{id, part, n, action, from, to, at}`, where `action` is `answer`, `change` or `default`. Use `action: profiles` on the `audit` ids and the `by` ids to get names. The author of an event is the `audit` document id, which the server checks. If `answers.by` differs from the author of the event whose `id` equals `answers.rev`, say so in the Record section. If there is no `audit` collection, the page is older than 0.3.0: write "No change history recorded (page older than 0.3.0)."
2. **Compare with the page.** Every part is one of: **Answered**, **Changed (N×)** (N = its `change` events), **Default applied by the owner** (`viaDefault: true`), or **Unanswered**. An answer with no matching event is marked "not in the log". Unanswered parts get their default only after the deadline. Say which rows are which. Never present a default as a decision someone made.
3. **Group questions into decisions.** One ADR per decision cluster, not per question. Related questions on one feature belong in one ADR.
4. **Write the ADR** from `adr-template.md`:
   - Path: `docs/adr/NNNN-short-slug.md`. Take NNNN from `ls docs/adr` (next number, four digits).
   - Fill Context from the issues and the "why" text. Fill the Decision table from the answers. Use `other` and `note` text word for word, quoted.
   - Fill the Changes section from the `change` events, one line each, in time order: "Q1b: 'Retry only once.' → 'Retry up to 3 times.', by <name>, 30 Sep 2026 10:15 IST." For a note-only change write "Q1b: note edited by <name>, <date>", then quote the new note. Name only, never email. If two people share a name, add the first 6 characters of their id.
   - Add Options considered from the option lists, and Consequences with follow-ups that each carry an issue number.
   - Write human-facing text in plain, short sentences (ASD-STE100 where the project asks for it). Keep technical names as they are.
   - The controller writes the ADR. It is an architecture record, not mechanical work.
5. **Keep the project rules in sync.** If the decision changes a rule in a project rule file (for example AGENTS.md, CLAUDE.md or a doctrine file), change the rule and the ADR in the same commit, and run any docs sync the project requires. If it does not change a rule, the ADR alone is enough.
6. **Close the loop on the tracker.** For each answered issue, post the decision as a comment: who decided, the date, the choice, a link to the ADR. Use the project's tracker agent or `gh`. Tag the reporter. Update the milestone only if the user says so. Ask before posting if the project has a rule about that.
7. **Report** in a short table: question | answer | source (answered, changed N×, default) | ADR | issue comment posted. List anything still unanswered.

## Rules

- Run Step 0 first. Stop if the question is not a real decision.
- Push back on the user's question list when a question is already answered, belongs to someone else, or has more than four options. Say so before you build.
- Do not invent answers. Do not record an option nobody chose.
- Do not overwrite an existing page or ADR without saying so. Artifact versions are kept, so a replace is reversible, but say it.
- Keep each ADR to one decision cluster. If it grows past two pages, split it.
- Never put secrets, phone numbers or emails on the page or in the ADR.

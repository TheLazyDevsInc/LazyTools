---
name: help-me-test
description: Turn a release's changes into a tester checklist Artifact, where each tester marks every test Pass, Fail, Blocked or Skip, then read the results back and write a test report. Use when the user says "test plan for release X", "what should testers check", "make a tester checklist", or "summarise the test results".
---

# Help me test: release to tester checklist to report

Two phases. Phase 1 builds a test guide for one release and publishes it as an Artifact. Each tester ticks their own result on every test. Phase 2 reads every tester's results and writes a test report with the failures and blockers first.

The page is a fixed template. Do not redesign it per release. Only the data arrays and placeholders change.

Requirements:
- Claude Code signed in to claude.ai, with the `Artifact` and `ArtifactData` tools, and the `artifact-design` and `artifact-capabilities` skills. The page saves results with the artifact `db` capability. If these tools are missing, stop and tell the user. Do not fake the page with a static file: it could not collect results.
- Testers can open the artifact and have Contributor or Editor access.

Files in this skill (read them from the skill folder):
- `template.html`: the page. Fill the placeholders and the data arrays.
- `report-template.md`: the report layout.
- `check.mjs`: checks the filled page before publish.
- `examples/sample-tests.md`: a filled set of arrays for a made-up release.

## Step 0: inputs

Ask for what is missing. Do not invent any of it:
1. The product name, the version and the test site (for example a beta URL).
2. The release date, and the deadline for test results.
3. The sources of change: a changelog, the merged PRs or commits since the last release, the milestone, or the previous test guide. Read them all.
4. The roles that test (for example teacher, admin, recruiter), so tests can be grouped by role.
5. The timezone and locale the testers use.
6. The tracker repo for issue links, or "none".

## Phase 1: build and publish the tester page

1. **Find what changed.** Read every source. For each merged change, note what a user can now do, what was broken and now works, and what is safer or more private. Leave out changes a user cannot see. List the items that are planned but not built, so nobody tests them. Verify against the source yourself. Do not trust a helper agent's summary for this step.
2. **Write the tests.** One test per thing a tester can check.
   - A short title, 1 to 5 numbered steps, an **Expected** line and a **Tell us if** line. Testers read "Tell us if" to decide Fail.
   - Write for the tester, not the engineer. Use the product's real screen and button names. Short sentences, one idea each.
   - Group tests by role in `SECTIONS`. Put the tests everyone does in one section with `mine:1`. Give each section a rough time in minutes.
   - Give each test a stable `id` (`t1`, `t2`, …) and a number `n`. Never reuse an id for a different test, even when you renumber: results are stored by id.
   - Put the issue number in `iss` (`'#123'`) when there is one.
   - If a test changes real data, say so in a `SETUP` step and in the test, and agree who reverts it.
3. **Write the rest.**
   - `SETUP`: what the release owner does before testers start (deploy, accounts, test data, engineer checks). Use `pre` for a command or query. Testers can skip this box.
   - `CHANGES`: "What changed" in plain words, grouped by kind.
   - `BEFORE`: where to go and what not to do (for example "do not delete records").
   - `REPORT`: how results reach the owner, and what to report at once (for example personal data shown to the wrong person).
4. **Fill the template.**
   - Replace `{{TITLE}}`, `{{EYEBROW}}` (for example `NOTELY · VERSION 2.4.0 · TESTING ON BETA · RELEASE FRI 9 OCT 2026`), `{{LEDE}}` (two sentences: what the release is, and when to test), `{{SOURCE_LINE}}` (what the guide covers, for example "Everything merged up to `abc1234`, 1 Oct 2026") and `{{ISSUE_BASE}}` (for example `https://github.com/OWNER/REPO/issues/`, or an empty string).
   - Replace `{{TIMEZONE}}` (an IANA name such as `Asia/Kolkata`), `{{TZ_LABEL}}` (for example `IST`) and `{{LOCALE}}` (for example `en-IN`).
   - Replace every `EXAMPLE:` entry in `SETUP`, `CHANGES`, `BEFORE`, `SECTIONS`, `TESTS` and `REPORT`. Text may use `` `code` `` and `**bold**`; nothing else renders as markup.
   - Check real dates with `date`. Never guess a weekday.
5. **Check and publish.** Run `node check.mjs <filled-page.html>` from the skill folder. Fix every failure. Before writing, load the `artifact-design` and `artifact-capabilities` skills. Publish with the Artifact tool and `capabilities: {"db": {"rules": [{"path": "results", "read": "view", "write": "owner"}, {"path": "results/{self}", "write": "interact"}, {"path": "audit", "read": "view", "write": "owner"}, {"path": "audit/{self}", "write": "interact"}]}, "user": {"scopes": ["profile"]}}`. The rules let every tester read all results and the change log, and let each tester write only their own. Each tester's results live in one document, `results/<person id>`. Each save also adds one event to `audit/<person id>`.
   - Publish a new artifact for each release, so results never mix. To fix a mistake during a round, read the page first and republish to its `url`. Keep test ids the same.
6. **Tell the user how to share it.** Testers need Contributor or Editor access. Viewer and Commenter access cannot save, and the page may only find out on the first save. The message names the Contributor role.
7. **Check once.** Read the `results` collection with `ArtifactData` (`action: list`). It should be empty. Ask the user to open the page. The bar must read "0 of N done", where N is the number of tests in the `mine:1` sections. "0 of 0" means the page script failed. Say what you could not test: a real tap needs a signed-in tester.
8. **Send the link and the deadline.** Prepare a short message the user can forward to testers.

## Phase 2: read the results and write the report

1. **Read the results and the change log.** Use `ArtifactData` with `action: list` on `results`, then on `audit`. Each `results` document id is a person id; its `tests` map holds, per test id, `{n, status, label, note, at, rev}`, where `status` is `pass`, `fail`, `blocked` or `skip`. Each `audit` document id is a person id; its `events` list holds `{id, test, n, action, from, to, at}`, where `action` is `result` or `change`, and `from` and `to` have the shape `{status, label, note}`. Remove duplicate events with the same `id`. Use `action: profiles` on the person ids to get names.
2. **Tally each test.** Count pass, fail, blocked and skip. A test is **Failed** if any tester's current result is Fail, **Blocked** if none failed but someone is blocked, **Passed** if at least one tester passed and nobody failed or is blocked, and **Not tested** if it has no result other than Skip. Say how many testers covered each section.
3. **Write the report** from `report-template.md`, in the place the user names (default `docs/test-reports/<version>.md`):
   - Failures and blockers first, each with the testers' notes quoted word for word, the tester's name and time.
   - Then tests not tested, then passes in one short table.
   - A "Changed results" list from the `change` events, one line each, in time order.
   - Name only, never email. If two people share a name, add the first 6 characters of their id.
   - Do not call the release ready. List what blocks it and let the user decide.
4. **Close the loop, only if the user asks.** Offer to raise an issue for each failure, with the steps, the expected result and the testers' notes. Do not post anything without the user's word.
5. **Report** in a short table in chat: test | result | testers | issue raised. List anything still untested.

## Rules

- Never put secrets, passwords, phone numbers or email addresses on the page or in the report. Test accounts go to testers by another route.
- Do not invent a test result. A test with no result is "Not tested", never "Passed".
- Do not overwrite a page that already has results without saying so. Artifact versions are kept, but say it.
- Keep each test checkable in a few minutes. Split a long test.

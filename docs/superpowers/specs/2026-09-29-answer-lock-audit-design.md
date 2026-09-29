# Answer lock and change log: design

**Date:** 2026-09-29
**Decision record:** `docs/adr/0001-lock-answers-and-log-changes.md`
**Target:** lazytools 0.3.0, skill `help-me-decide`

## Goal

A saved answer locks, so a stray tap cannot change it. A change needs a deliberate action. Every save and change is logged with the signed-in person, the old value, the new value and the time. Phase 2 shows the changes in the ADR.

## Success criteria

1. A tap on an option in an open part saves it and locks the part.
2. A locked part cannot change until the person presses **Change answer**.
3. In change mode, nothing saves until **Save change**. **Cancel** restores and locks the part.
4. Every save writes one log event under `audit/<person id>`. A person cannot write under another person's id.
5. If a teammate saved the part after change mode opened, **Save change** stops and asks the person to check.
6. Everyone who can open the page sees each part's history.
7. The Phase 2 ADR lists every change with the name, from, to and date.
8. Pages made before 0.3.0, with no `audit`, still work in Phase 2.

## Part states

Each part has one of four states.

| State | When | Options | Other text and note | Buttons |
|---|---|---|---|---|
| Open | No saved choice | Enabled | Enabled | **Save** shows only when "Other" is picked |
| Locked | Saved choice, not editing | Disabled | Disabled | **Change answer** |
| Changing | After Change answer | Enabled | Enabled | **Save change** (disabled until something differs), **Cancel** |
| Read-only | Viewer, Commenter, or no `db` | Disabled | Disabled | None |

Rules:
- **Open, option tap (not Other):** save with `action: "answer"` and lock. The note in the box is saved with it.
- **Open, Other:** the tap focuses the text box and shows **Save**. **Save** needs non-empty text, then saves and locks.
- **Changing:** taps and typing change only the screen. **Save change** saves with `action: "change"`. A note-only edit is also a change.
- **Use the default button:** for each open part with a default, in a group with `acceptDefaults: true`, save with `action: "default"` and `viaDefault: true`, then lock. Locked and changing parts are skipped.
- The note autosave (`later()`, 700 ms) is removed. A note is saved only with a choice. This is a behavior change: a note alone, with no choice, is no longer saved.
- Locked parts show "Saved by <name> · <time>" as today, plus "(changed N×)" when N > 0.

## Data

### `answers/<part id>` (unchanged fields plus one)

`n`, `part`, `choice`, `label`, `other`, `note`, `by`, `at`, `viaDefault`, plus:
- `rev`: the id of the log event that wrote this state (string).

### `audit/<person id>` (new; one document per person)

```json
{ "events": [
  { "id": "e_k2x9…", "part": "q1b", "n": 1, "action": "change",
    "from": { "choice": "one", "label": "Retry only once.", "other": "", "note": "" },
    "to":   { "choice": "three", "label": "Retry up to 3 times.", "other": "", "note": "" },
    "at": 1790674279184 }
] }
```

- `action` is `answer`, `change` or `default`. `from` is `null` for `answer` and `default`.
- `id` is made by the page (random, prefix `e_`). It links the event to `answers.rev`.
- The person's id comes from the path, which the server checks. The event holds no `by` field.
- Size: a document holds 256 KiB, which is more than 1,000 events. The store holds 5,000 documents, and we use one per person plus one per part.

### Access rules (published with the page)

```json
{ "db": { "rules": [
  { "path": "audit", "read": "view", "write": "owner" },
  { "path": "audit/{self}", "write": "interact" }
] }, "user": { "scopes": ["profile"] } }
```

- Everyone who can open the page reads all logs.
- Each Contributor or above writes only `audit/<own id>`.
- `answers` keeps the default rules: read `view`, write `interact`.

## Save sequence

1. Build the event from the state before and after.
2. For a change: `get()` `answers/<part id>`. If its `rev` is not the `rev` seen when change mode opened, stop. Show "<name> changed this answer while you were editing. Check it, then save again." Stay in change mode and show the new saved value.
3. `set()` `answers/<part id>` with the new state and `rev: event.id`.
4. `set()` `audit/<own id>` with `events: [...current events, event]`. The current events come from the live subscription.
5. If step 4 fails, retry once. If it fails again, show "Answer saved, but the log entry failed. Press Retry log." Keep the event in memory for **Retry log**.

Steps 2 and 3 can still race if two people save within the same second. Both events stay in the log, so Phase 2 still sees both.

## Reading

- Subscribe once to `answers` (as today) and once to `audit`.
- The history for a part is every event with that `part`, from all `audit` documents, sorted by `at`.
- Names are resolved with `user.profiles(ids)` at render time, as today. `name || "Someone"`.
- Each part shows a `<details>` element "History (N)". Each line reads "<name> chose '<label>' · <time>" or "<name> changed '<from>' → '<to>' · <time>". A note change reads "<name> edited the note · <time>".

## Phase 2 changes (`SKILL.md` and `adr-template.md`)

1. Read `answers`, then `audit` (`ArtifactData` `list`). Get names with `profiles` on the `audit` document ids and the `answers.by` ids.
2. The **Source** column is one of: **Answered**, **Changed (N×)**, **Default applied**, **Unanswered**.
3. The name comes from the `audit` path. If `answers.by` differs from the author of the event matching `answers.rev`, say so in the Record section.
4. A new **Changes** section in `adr-template.md`, one line per change: "Q1b: 'Retry only once.' → 'Retry up to 3 times.', by <name>, 30 Sep 2026 10:15 IST."
5. Name only, never email. If two people share a name, add the first 6 characters of the id.
6. If there is no `audit` collection, write "No change history recorded (page older than 0.3.0)."
7. An answer with no matching event is marked "not in the log".

## Tests (`tests/template.test.mjs`)

Keep the 7 offline tests. Add a fake `window.claude` with an in-memory `db` (doc `get`/`set`, collection `onSnapshot`) and `user` (`id`, `can`, `profiles`). New tests:

1. A tap on an option saves `answers/q1a` and adds one `answer` event to `audit/<fake id>`. The part is locked (radios disabled, Change answer shows).
2. Change answer, then a tap, writes nothing. Cancel restores the saved choice and locks the part.
3. Change answer, tap, Save change writes a `change` event with the correct `from` and `to`, and sets `answers.rev` to the event id.
4. A note-only change is logged as `change`.
5. "Other" does not save until Save, and Save needs text.
6. The fake store changes `answers/q1a.rev` after change mode opens, so Save change stops, shows the message and writes nothing.
7. With `can("data.write")` false, all parts are read-only with no Change button.
8. The default button writes `default` events only for open parts.
9. History shows events from two fake people in time order.

Red first: tests 1 to 9 fail on the 0.2.2 template.

## Build order

1. **Check the rules on the real store** before building. Publish a small test page with the rules above. Use `ArtifactData` to confirm: (a) at `interact` you can write `audit/me` but not `audit/<another id>`; (b) at `view` you can list `audit`; (c) the owner can list `audit` and read every document. If any check fails, stop and revise this spec.
2. Write the new tests (red).
3. Change `template.html` until the tests pass.
4. Update `SKILL.md` (publish rules in Phase 1 step 4; Phase 2 steps) and `adr-template.md` (Changes section).
5. Bump `plugin.json` to `0.3.0`.
6. Publish a filled page, open it, and do one real answer, change and cancel.

## Not in scope

- A log nobody can edit. People can edit their own `audit/<id>`.
- Emails anywhere.
- Changes to `check.mjs`. The data shape of `Q` does not change.

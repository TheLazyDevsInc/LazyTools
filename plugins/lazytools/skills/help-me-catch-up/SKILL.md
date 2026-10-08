---
name: help-me-catch-up
description: Turn the current conversation or session into a short recap Artifact with how you got here, where things stand and 2 or 3 ways to carry on, each with a prompt you can paste. Use when the user says "catch me up", "where were we", "recap this", "what was I doing" or comes back to a task after switching away.
---

# Help me catch up: session to recap page

One phase. Read what happened in this session, then publish a short recap as an Artifact: how we got here, where things stand, and 2 or 3 ways to carry on. The reader is one person coming back to a task cold. The page is read-only and saves nothing.

The page is a fixed template. Do not redesign it per recap. Only the data arrays and placeholders change.

Requirements:
- Claude Code signed in to claude.ai, with the `Artifact` tool and the `artifact-design` skill. If the `Artifact` tool is missing, give the recap as a short message in chat in the same order, and say why.
- No `capabilities` are needed. Do not ask for `db`, `user` or anything else.

Files in this skill (read them from the skill folder):
- `template.html`: the page. Fill the placeholders and the data arrays.
- `check.mjs`: checks the filled page before publish.
- `examples/sample-recap.md`: a filled set of arrays for a made-up session.

## Step 0: scope

Do not interview the user. A recap is for someone in a hurry. Decide these yourself and say what you chose in `SOURCE_LINE`:
1. **What to recap.** By default, this conversation. If the user names a task, a branch or a PR ("catch me up on the billing work"), recap that and say so.
2. **How far back.** The whole conversation, but weight the recent part. If the conversation was compacted, say that the early part comes from a summary.
3. **Ask only if you cannot tell** which of several unrelated tasks the user means. One question, with the tasks as options.

## Build and publish the recap

1. **Gather facts. Do not rely on memory of the conversation alone.**
   - Re-read the conversation: the request, the decisions, the dead ends, the last thing done and what the user was told to expect next.
   - Check the real state of the work with read-only commands when there is a repo: `git status -sb`, `git log --oneline -10`, `git diff --stat`, the open PR and its CI result if there is one, and any task list in the session. Trust these over your memory. If they disagree with the conversation, say so in `CAVEATS`.
   - Do not run tests, builds or anything that changes files or sends data just to write a recap.
2. **Write `NOW`.** One to three short paragraphs: what the work is, where it is right now, and the one thing that matters most. Lead with the answer to "where was I?".
3. **Write `STORY`.** Four to eight entries, oldest first, each one plain sentence, with a short `when` label such as the phase or a time. Keep decisions and the reason for them ("chose X over Y because Z"), dead ends that would otherwise be tried again, and the moment the work was left. Drop the blow-by-blow.
4. **Write `STATE`.** Lists by kind: `done` (finished and checked), `doing` (started, not finished), `open` (not started, or deferred on purpose), `blocked` (waiting on something, and on what). Leave a kind out if it is empty. Only call something `done` if you saw it pass or finish.
5. **Write `OPTIONS`.** Two or three ways to carry on, ids `a`, `b`, `c`, exactly one with `rec:1`. They must be different in kind, not three sizes of the same thing: for example finish, check first, cut scope or switch to something else. Each has:
   - `title`: a short verb phrase.
   - `cost`: a rough size in words ("about 20 minutes", "one command"). If you cannot tell, leave it out. Do not invent a number.
   - `why`: when this is the right pick, in one or two sentences.
   - `first`: the first concrete step.
   - `prompt`: text the user can paste as their next message. Write it so it works in a fresh session too: name the branch, file or PR. Never include secrets or tokens.
   Recommend the option that gets the user to a checked, shippable state with the least risk. Say why in `why`.
6. **Write `CAVEATS`.** What you could not check, guessed, or that disagrees with the conversation. Skip the array contents (leave it empty) when there is nothing.
7. **Fill the template.**
   - Replace `{{TITLE}}` (a name for the task, two to six words, not "Catch-up"), `{{EYEBROW}}` (for example `CATCH-UP · 8 OCT 2026`), `{{LEDE}}` (one sentence: where the user was) and `{{SOURCE_LINE}}` (what the recap is built from, for example "Built from this conversation and `git log` on `share-links`.").
   - Replace every `EXAMPLE:` entry in `NOW`, `STORY`, `STATE` and `OPTIONS`. Text may use `` `code` `` and `**bold**`; nothing else renders as markup.
   - Check real dates with `date`. Never guess a weekday.
8. **Check and publish.** Run `node check.mjs <filled-page.html>` from the skill folder. Fix every failure. Before writing, load the `artifact-design` skill. Publish with the Artifact tool and no `capabilities`.
   - Publish a new artifact for each recap. A recap is a snapshot of one moment. Do not republish over an old one unless the user asks.
9. **Reply in chat in three lines or fewer:** the link, where things stand in one sentence, and which option you recommend. Do not repeat the page.

## Rules

- Never put secrets, tokens, phone numbers or email addresses on the page. Name where a secret lives, never its value.
- Do not invent history. If you do not know why something was decided, say "reason not recorded" rather than make one up.
- Do not mark anything done that you did not see finish. Unverified goes in `doing` or `CAVEATS`.
- Do not start any of the options. The user picks. Offer the recommended one in one line, then wait.
- Keep it short enough to read in a minute. If the recap is longer than the work it describes, cut it.

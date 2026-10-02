# lazytools

Small skills for Claude Code, by The LazyDevs Inc.

| Skill | What it does | Command |
|---|---|---|
| `help-me-decide` | Turns open decisions into a multiple-choice page. Then turns the saved answers into an ADR. | `/lazytools:help-me-decide` |
| `help-me-review` | Turns a pull request into a review checklist page. Each reviewer marks every item Looks good, Change needed, Question or Skip. Then turns the verdicts into a review summary. | `/lazytools:help-me-review` |

## Install

```
/plugin marketplace add TheLazyDevsInc/LazyTools
/plugin install lazytools@thelazydevs
```

## help-me-decide

Two jobs:

1. **Ask.** It turns your open decisions into a multiple-choice page (a claude.ai Artifact). The decision owner taps a choice for each question. Each choice saves and locks. A change needs Change answer, and every change is logged with who made it.
2. **Record.** It reads the saved answers back and writes an ADR (architecture decision record). It marks each row as answered or default-applied.

Ask Claude in plain words, for example: "make an MCQ for Sam with the open questions on the billing issues". Or run `/lazytools:help-me-decide`.

The skill:
- reads every issue comment and chat you point to, and drops what is already answered,
- builds one card per question, with 2 to 4 options and a default,
- publishes the page and tells you how to share it,
- later reads the answers and writes `docs/adr/NNNN-slug.md`,
- posts each decision on its issue.

### Requirements

- Claude Code. The skill needs the `Artifact` and `ArtifactData` tools, so it does not run in the Claude web, desktop or mobile apps.
- Signed in to claude.ai.
- The `artifact-design` and `artifact-capabilities` skills.
- The decision owner has Contributor or Editor access to the artifact. Viewer and Commenter access cannot save: the page may only find that out on the first save and then shows "Could not save". Share it as Contributor.

### Files

| Path | What |
|---|---|
| `skills/help-me-decide/SKILL.md` | The workflow and its rules |
| `skills/help-me-decide/template.html` | The multiple-choice page |
| `skills/help-me-decide/adr-template.md` | The ADR layout |
| `skills/help-me-decide/check.mjs` | Checks the filled page before publish |
| `skills/help-me-decide/examples/` | A filled question set and a finished ADR |

## help-me-review

Two jobs:

1. **Check.** It reads one pull request (description, linked issues, diff, CI) and writes a review guide: what the PR does, then items grouped by area, each with the code to look at, a "Fine if" line, an "Ask for a change if" line, a file reference and a severity. It publishes the guide as a claude.ai Artifact. Each reviewer ticks the areas they review and marks each item Looks good, Change needed, Question or Skip. Change needed and Question need a note. Each verdict saves and locks. A change needs Change verdict, and every change is logged. Every reviewer sees the team's verdicts on each item.
2. **Summarise.** It reads every reviewer's verdicts back and writes a review summary, with changes and questions first and the reviewers' notes word for word. It does not say the PR is ready to merge.

Ask Claude in plain words, for example: "make a review checklist for PR 231 and split it between me and Priya". Or run `/lazytools:help-me-review`.

Requirements are the same as help-me-decide. Share the page with reviewers as Contributor.

| Path | What |
|---|---|
| `skills/help-me-review/SKILL.md` | The workflow and its rules |
| `skills/help-me-review/template.html` | The reviewer page |
| `skills/help-me-review/review-template.md` | The summary layout |
| `skills/help-me-review/check.mjs` | Checks the filled page before publish |
| `skills/help-me-review/examples/` | A filled review guide for a made-up PR |

### Privacy and data

Full policy: https://thelazydevs.com/lazytools/privacy/

What the plugin stores, and where:
- **Answers and change log.** The page saves each answer and a per-person change log in the artifact's own database on claude.ai. Each record holds the signed-in person's profile id, the choice, any "Other" text or note they typed, and a time. The page reads display names to show "Saved by …". It does not store names or email addresses.
- **Review verdicts and change log (help-me-review).** The page saves each reviewer's verdicts in one record per person, and a per-person change log, in the artifact's own database. Each verdict holds the reviewer's profile id, the status, any note they typed, and a time. Which areas a reviewer ticked is kept only in their own browser. The page shows code references (file and line) from the PR, not code.
- **Who can see it.** Everyone who can open the artifact can read the answers and the log. Anyone with Editor access to the artifact can change them, so the log is a record, not tamper-proof. Do not put secrets, phone numbers or email addresses on the page.
- **The ADR and the review summary.** The ADR names the people who answered. The review summary names the reviewers and quotes their notes. Both are files in your repository.
- **No service of ours.** The plugin has no server and no analytics. The plugin authors do not receive or keep any data.

Data that leaves claude.ai:
- **Your issue tracker (optional).** In the Record step the skill can post each decision as a comment on the matching issue in your tracker (GitHub by default), with the decider's name, the date, the choice and a link to the ADR. It uses `gh` for GitHub or your project's tracker agent for other trackers, and asks first if your project has a rule about posting.
- **GitHub (optional).** In help-me-review's summary step, the skill can post the changes and questions as review comments on the pull request, only when you ask. It reads the PR through `gh` or the GitHub connector. It never approves or requests changes without your word.
- **Google Fonts.** The page loads its fonts from Google Fonts, which sees the viewer's IP address. Without network access it falls back to system fonts.

Privacy questions: privacy@thelazydevs.com.

### What it runs

The skill runs locally on your machine:
- `node check.mjs <page.html>` to validate the filled question or review page before publishing. check.mjs reads only that file and prints OK or errors. It makes no network calls.
- `date` to verify dates you enter match actual weekdays.
- `ls docs/adr` to find the next ADR file number.

On claude.ai, it uses:
- Artifact tool to publish the page.
- ArtifactData tool to read the saved answers, verdicts and change log.
- Optional: `gh` (GitHub) or your project's tracker agent to post decisions as issue comments.

It does not install packages, download code, or change Claude's permission settings.

## Licence

MIT. See `LICENSE`.

Provided as is, without warranty of any kind. Generated decision pages and ADRs are drafts: check them before you rely on them.

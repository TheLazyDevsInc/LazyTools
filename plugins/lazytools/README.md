# lazytools

Small skills for Claude Code, by The LazyDevs Inc.

| Skill | What it does | Command |
|---|---|---|
| `help-me-decide` | Turns open decisions into a multiple-choice page. Then turns the saved answers into an ADR. | `/lazytools:help-me-decide` |
| `help-me-test` | Turns a release's changes into a tester checklist page. Each tester marks every test Pass, Fail, Blocked or Skip. Then turns the results into a test report. | `/lazytools:help-me-test` |

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

## help-me-test

Two jobs:

1. **Check.** It reads a release's changes (changelog, merged PRs, milestone) and writes a test guide: what changed, then tests grouped by role, each with steps, an expected result and a "tell us if" line. It publishes the guide as a claude.ai Artifact. Each tester ticks the parts that match their job and marks each test Pass, Fail, Blocked or Skip. Fail and Blocked need a note. Each result saves and locks. A change needs Change result, and every change is logged. Every tester sees the team's results on each test.
2. **Report.** It reads every tester's results back and writes a test report, with failures and blockers first and the testers' notes word for word.

Ask Claude in plain words, for example: "make a tester checklist for release 1.8.0 from the PRs merged since 1.7.0". Or run `/lazytools:help-me-test`.

Requirements are the same as help-me-decide. Share the page with testers as Contributor.

| Path | What |
|---|---|
| `skills/help-me-test/SKILL.md` | The workflow and its rules |
| `skills/help-me-test/template.html` | The tester page |
| `skills/help-me-test/report-template.md` | The report layout |
| `skills/help-me-test/check.mjs` | Checks the filled page before publish |
| `skills/help-me-test/examples/` | A filled test guide for a made-up release |

### Privacy and data

Full policy: https://thelazydevs.com/lazytools/privacy/

What the plugin stores, and where:
- **Answers and change log.** The page saves each answer and a per-person change log in the artifact's own database on claude.ai. Each record holds the signed-in person's profile id, the choice, any "Other" text or note they typed, and a time. The page reads display names to show "Saved by …". It does not store names or email addresses.
- **Test results and change log (help-me-test).** The page saves each tester's results in one record per person, and a per-person change log, in the artifact's own database. Each result holds the tester's profile id, the status, any note they typed, and a time. Which parts a tester ticked is kept only in their own browser.
- **Who can see it.** Everyone who can open the artifact can read the answers and the log. Anyone with Editor access to the artifact can change them, so the log is a record, not tamper-proof. Do not put secrets, phone numbers or email addresses on the page.
- **The ADR and the test report.** The ADR names the people who answered. The test report names the testers and quotes their notes. Both are files in your repository.
- **No service of ours.** The plugin has no server and no analytics. The plugin authors do not receive or keep any data.

Data that leaves claude.ai:
- **Your issue tracker (optional).** In help-me-test's Report step, the skill can raise an issue in your tracker for each failure, only when you ask. In help-me-decide's Record step the skill can post each decision as a comment on the matching issue in your tracker (GitHub by default), with the decider's name, the date, the choice and a link to the ADR. It uses `gh` for GitHub or your project's tracker agent for other trackers, and asks first if your project has a rule about posting.
- **Google Fonts.** The page loads its fonts from Google Fonts, which sees the viewer's IP address. Without network access it falls back to system fonts.

Privacy questions: privacy@thelazydevs.com.

### What it runs

The skill runs locally on your machine:
- `node check.mjs <page.html>` to validate the filled question or test page before publishing. check.mjs reads only that file and prints OK or errors. It makes no network calls.
- `date` to verify dates you enter match actual weekdays.
- `ls docs/adr` to find the next ADR file number.
- help-me-test writes its report to `docs/test-reports/<version>.md`, or where you say.

On claude.ai, it uses:
- Artifact tool to publish the page.
- ArtifactData tool to read the saved answers, test results and change log.
- Optional: `gh` (GitHub) or your project's tracker agent to post decisions as issue comments (help-me-decide) or raise an issue for each failure (help-me-test), only when you ask.

It does not install packages, download code, or change Claude's permission settings.

## Licence

MIT. See `LICENSE`.

Provided as is, without warranty of any kind. Generated decision pages and ADRs are drafts: check them before you rely on them.

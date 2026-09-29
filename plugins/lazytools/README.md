# lazytools

Small skills for Claude Code, by The LazyDevs Inc.

| Skill | What it does | Command |
|---|---|---|
| `help-me-decide` | Turns open decisions into a multiple-choice page. Then turns the saved answers into an ADR. | `/lazytools:help-me-decide` |

## Install

```
/plugin marketplace add TheLazyDevsInc/LazyTools
/plugin install lazytools@thelazydevs
```

## help-me-decide

Two jobs:

1. **Ask.** It turns your open decisions into a multiple-choice page (a claude.ai Artifact). The decision owner taps a choice for each question. Each choice saves right away.
2. **Record.** It reads the saved answers back and writes an ADR (architecture decision record). It marks each row as answered or default-applied.

Ask Claude in plain words, for example: "make an MCQ for Sam with the open questions on the billing issues". Or run `/lazytools:help-me-decide`.

The skill:
- reads every issue comment and chat you point to, and drops what is already answered,
- builds one card per question, with 2 to 4 options and a default,
- publishes the page and tells you how to share it,
- later reads the answers and writes `docs/adr/NNNN-slug.md`,
- posts each decision on its issue.

### Requirements

- Claude Code signed in to claude.ai, with the `Artifact` and `ArtifactData` tools.
- The `artifact-design` and `artifact-capabilities` skills.
- The decision owner has Contributor or Editor access to the artifact. With Viewer access the page shows "You can read but not save".

### Files

| Path | What |
|---|---|
| `skills/help-me-decide/SKILL.md` | The workflow and its rules |
| `skills/help-me-decide/template.html` | The multiple-choice page |
| `skills/help-me-decide/adr-template.md` | The ADR layout |

### Privacy

Answers live in the artifact's own database. They are visible to everyone who can open the artifact. Do not put secrets, phone numbers or email addresses on the page.

The page loads its fonts from Google Fonts. Without network access it falls back to system fonts.

## Licence

MIT. See `LICENSE`.

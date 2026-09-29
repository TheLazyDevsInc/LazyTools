# LazyTools

Small skills for Claude Code, by The LazyDevs Inc. Each skill is its own plugin. Install only the ones you want.

| Plugin | What it does | Install | Command |
|---|---|---|---|
| [`help-me-decide`](plugins/help-me-decide) | Turns open decisions into a multiple-choice page. Then turns the saved answers into an ADR. | `/plugin install help-me-decide@lazytools` | `/help-me-decide:help-me-decide` |

## Install

Add the marketplace once:

```
/plugin marketplace add TheLazyDevsInc/LazyTools
```

Then install a plugin by name, in the form `plugin@marketplace`:

```
/plugin install help-me-decide@lazytools
```

## Adding a plugin

1. Make `plugins/<name>/.claude-plugin/plugin.json` and `plugins/<name>/skills/<name>/SKILL.md`.
2. Put any templates or scripts next to the skill.
3. Add an entry to `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"`.
4. Add a row to the table above.

## Licence

MIT. See `LICENSE`. Copyright (c) 2026 The LazyDevs Inc.

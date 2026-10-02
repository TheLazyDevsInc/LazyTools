# LazyTools

Small skills for Claude Code, by The LazyDevs Inc. One plugin, `lazytools`. It holds many skills. Install it once and you get all of them.

| Skill | What it does | Command |
|---|---|---|
| `help-me-decide` | Turns open decisions into a multiple-choice page. Then turns the saved answers into an ADR. | `/lazytools:help-me-decide` |
| `help-me-test` | Turns a release's changes into a tester checklist page. Each tester marks every test Pass, Fail, Blocked or Skip. Then turns the results into a test report. | `/lazytools:help-me-test` |

## Install

Add the marketplace once. It is named `thelazydevs`:

```
/plugin marketplace add TheLazyDevsInc/LazyTools
```

Then install the plugin, in the form `plugin@marketplace`:

```
/plugin install lazytools@thelazydevs
```

## Adding a skill

1. Make `plugins/lazytools/skills/<skill-name>/SKILL.md` with a `name` and a `description`.
2. Put any templates or scripts next to it.
3. Add a row to the table above.
4. Raise `version` in `plugins/lazytools/.claude-plugin/plugin.json`.

## Adding another plugin

The marketplace `thelazydevs` can hold more plugins. Make `plugins/<name>/` with its own `.claude-plugin/plugin.json`, then add an entry to `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"`.

## Development

Run `npm install` once, then `npm test`. The tests load each skill's `template.html` in jsdom with its sample data and check that the decision cards and the tester page render and save.

## Licence

MIT. See `LICENSE`. Copyright (c) 2026 The LazyDevs Inc.

Provided as is, without warranty of any kind. See `LICENSE`.

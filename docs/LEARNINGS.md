# Learnings

- A skill named `decision-questions` showed in the session skill list but was not found in ~/.claude/skills, the plugin cache, marketplaces, `/skills` or `/plugin`. Origin unknown. Likely stale in that session. Re-check in a new session before acting on it.
- help-me-decide `template.html` 0.2.0 rendered no cards ("0 of 0 answered"). `build()` called `getElementById` on inputs inside a card not yet in the document, got `null` and threw. Fix: append each card to its group before building its parts. `check.mjs` checks data only, so it cannot catch page script errors. Open the published page once before you call a test done.

# {{Product}} {{version}} test report

**Test site:** {{site}} · **Round:** {{first result}} to {{last result}} {{TZ}}
**Testers:** {{N}} people · **Guide:** {{artifact link}}

## Summary

{{One short paragraph: how many tests, how many failed or are blocked, and which sections had no tester. Do not say the release is ready.}}

| Result | Tests |
|---|---|
| Failed | {{n}} |
| Blocked | {{n}} |
| Passed | {{n}} |
| Not tested | {{n}} |

## Failures and blockers

### Test {{n}}: {{title}} ({{#issue}}) — Failed

- **Expected:** {{expected}}
- **{{Name}}, {{date time}}:** "{{note, word for word}}"
- **{{Name}}, {{date time}}:** "{{note}}"
- Passed for: {{names}}

## Not tested

- Test {{n}}: {{title}} ({{section}})

## Passed

| Test | Title | Pass | Skip |
|---|---|---|---|
| {{n}} | {{title}} | {{count}} | {{count}} |

## Changed results

- Test {{n}}: Pass → Fail, by {{name}}, {{date time}}. "{{new note}}"

## Follow-ups

- [ ] {{Issue to raise or fix, with its test number}}

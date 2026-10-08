# Example: Notely, shared folder links

Notely is a made-up notes app. This recap covers a session where the user added share links for folders, then switched to another task and came back an hour later.

```js
var NOW=[
  'The share-link endpoint and its permissions check are written and pass their tests. The settings screen is half built: the toggle works, the copy button does not.',
  'The branch is `share-links`. One test is skipped on purpose until the screen is done.'
];

var STORY=[
  {when:'Start',t:'You asked for folders to be shareable by link, read-only, with an off switch.'},
  {when:'Design',t:'We chose a random token stored per folder over signed URLs, so a link can be turned off without changing any key.'},
  {when:'Server',t:'Added `POST /folders/:id/link` and `canRead()`. Every folder read now goes through the check.'},
  {when:'Bug',t:'A test showed deleted folders still answered on their old link. Fixed by checking `deletedAt` in `canRead()`.'},
  {when:'Screen',t:'Started the settings screen. The on and off toggle works. The copy button is not wired yet.'},
  {when:'Switch',t:'You left to work on something else before link expiry came up.'}
];

var STATE=[
  {kind:'done',items:['Link endpoint, with tests.','`canRead()` on every folder read.','Deleted folders no longer answer on a link.']},
  {kind:'doing',items:['Settings screen: toggle done, copy button not wired.']},
  {kind:'open',items:['Link expiry. You said later, so it is **not** in this branch.','One skipped test in `link.test.js`.']}
];

var OPTIONS=[
  {id:'a',rec:1,title:'Finish the screen, then open the PR',cost:'about 20 minutes',
   why:'The server side is done, so the screen is the only thing between you and a reviewable PR.',
   first:'Wire the copy button in `SettingsLink.jsx`, then un-skip the test.',
   prompt:'Finish the settings screen: wire the copy button, un-skip the test in `link.test.js`, run the tests, then open a draft PR.'},
  {id:'b',title:'Review what is on the branch first',cost:'about 10 minutes',
   why:'Pick this if you have lost track of the server changes and want to check them before building on them.',
   first:'Read the diff against `main` and list anything risky.',
   prompt:'Review the diff on `share-links` against `main` and list anything risky before we carry on.'},
  {id:'c',title:'Drop the screen, ship the server alone',cost:'about 5 minutes',
   why:'Pick this if the screen can wait. The endpoint is useful on its own for the mobile app.',
   first:'Remove the half-built screen from the branch and open the PR for the server only.',
   prompt:'Remove the settings screen from the branch, keep the server changes, and open a draft PR for the server only.'}
];

var CAVEATS=[
  'I did not run the app. The toggle result comes from the tests, not from the screen.'
];
```

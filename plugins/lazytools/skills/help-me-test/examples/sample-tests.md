# Example: Notely 2.4.0 beta test

Notely is a made-up notes app. Release 2.4.0 adds shared folders and a new editor toolbar, and fixes a sync bug (#212). About ten testers check it on the beta site before the release on Fri 9 Oct 2026. The tests are grouped by role, so each tester does only their part.

```js
var SETUP=[
  {t:'Deploy release candidate `2.4.0-rc.2` to beta, and check that the worker is up.'},
  {t:'Give each tester an account with the right role: writer, editor or admin.'},
  {t:'After the sync tests, an engineer runs this read-only check:',pre:"select count(*) from sync_jobs where state = 'stuck';\n-- expected: 0"}
];

var CHANGES=[
  {title:'Things you can now do',items:[
    {b:'Shared folders.',t:'Share a folder with a teammate. They see every note in it.'},
    {b:'A new toolbar.',t:'Bold, lists and links are now one tap away in the editor.'}
  ]},
  {title:'Things that were broken and now work',items:[
    {b:'Sync no longer stalls.',t:'A note edited on two devices at once now saves both edits (#212).'}
  ]}
];

var BEFORE=[
  {h:'Where to go',t:'Everything happens on `beta.notely.example`, not the live site. Sign in as you normally do.'},
  {h:'Beta has sample data',t:'Creating and editing is fine. Please do not delete notes you did not create.'}
];

var SECTIONS=[
  {id:'all',icon:'👋',title:'Everyone',mins:10,mine:1},
  {id:'ed',icon:'✏️',title:'If you edit shared notes',mins:10},
  {id:'adm',icon:'⚙️',title:'If you are an admin',mins:5}
];

var TESTS=[
  {id:'t1',n:1,s:'all',title:'Sign in and notice the speed',iss:'',
   steps:['Go to `beta.notely.example` and sign in.','Wait for your notes list to load.'],
   expected:'You land on your notes list, and it feels at least as quick as the live site.',
   tellUs:'anything is slower than usual, or you see an error page.'},
  {id:'t2',n:2,s:'all',title:'The new toolbar',iss:'#205',
   steps:['Open any note.','Use the toolbar to make a word **bold**, start a list and add a link.'],
   expected:'Each button works, and the note saves on its own.',
   tellUs:'a button does nothing, or the note loses your change.'},
  {id:'t3',n:3,s:'ed',title:'Share a folder',iss:'#198',
   steps:['Make a test folder with two notes.','Share it with another tester.','Ask them to open it.'],
   expected:'They see both notes and can edit them.',
   tellUs:'they cannot see the folder, or they see only one note.'},
  {id:'t4',n:4,s:'ed',title:'Edit on two devices at once',iss:'#212',
   steps:['Open the same note on your phone and your computer.','Type a different line on each, within a few seconds.','Wait one minute.'],
   expected:'Both lines are in the note on both devices.',
   tellUs:'a line is lost, or the note shows "Sync paused" for more than a minute.'},
  {id:'t5',n:5,s:'adm',title:'Remove someone from a shared folder',iss:'#198',
   steps:['Open Admin → Sharing.','Remove a tester from your test folder.'],
   expected:'The folder disappears from their list at once.',
   tellUs:'they can still open the folder after a refresh.'}
];

var REPORT=[
  'Your results save on this page as you go. The release owner reads them each evening.',
  'If you see someone else\'s private notes, stop and tell the release owner **at once**.'
];
```

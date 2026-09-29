# Example: ACME Billing decision questions

Sam, the product manager at ACME Billing, needs to decide on payment retry strategy (issue #41) and recurring invoice priorities (issue #42). The retry decision is needed by Fri 9 Oct 2026; recurring invoices can wait.

```js
var GROUPS=[
  {id:'now',title:'Needed soon',pill:'Please answer by Fri 9 Oct 2026',cls:'chg',acceptDefaults:true},
  {id:'later',title:'Can wait',pill:'Answer when you can',cls:'open',acceptDefaults:false}
];

var Q=[
  {n:1,g:'now',iss:'#41',text:'Should we auto-retry failed payments?',
   why:'Payment failures are often temporary. We need to decide whether to retry automatically or wait for the customer to retry manually.',
   parts:[
    {id:'q1a',t:'Enable auto-retry?',opts:[{id:'yes',l:'Yes, retry automatically.',d:1},{id:'no',l:'No, notify and wait.'}]},
    {id:'q1b',t:'How many times?',opts:[{id:'three',l:'Retry up to 3 times.',d:1},{id:'one',l:'Retry only once.'},{id:'five',l:'Retry up to 5 times.'}]}
   ]},
  {n:2,g:'later',iss:'#42',text:'What is our priority for recurring invoices?',
   why:'Several customers have asked for this feature. We need to decide if it is critical or can wait for next quarter.',
   parts:[
    {id:'q2a',opts:[{id:'critical',l:'Yes, it is critical.'},{id:'nice',l:'Yes, but it is nice-to-have.'},{id:'no',l:'No, out of scope.'}],nodef:1}
   ]}
];
```

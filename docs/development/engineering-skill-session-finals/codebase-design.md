I explored three independent designs for the Order intake cluster; no repository files changed.

1. Minimal interface

```js
acceptOrder(submittedJsonText) -> Order
```

The external seam sits between submitted JSON text and the accepted Order. Parsing, reference validation, and currency canonicalization stay entirely behind it. JSON syntax errors and `Error('reference required')` propagate; successful Orders have uppercase currency.

This offers the strongest depth and locality today: callers learn one operation, and all Order intake behavior changes in one module.

2. Flexibility-first catalog

```js
createOrderIntake({ preparations, defaultPreparation })
  .accept(submittedJsonText, { preparation, facts }) -> Order
```

A named `OrderPreparation` adapter would allow several concrete submitted-Order forms while the enclosing module enforces reference and canonical-currency rules universally. The secondary seam becomes real only once at least two preparations exist.

This has good leverage only if multiple Order forms are an imminent, concrete need. With today’s single JSON form, its construction interface, named selection, and open-ended facts reduce depth and locality.

3. Common-caller-first interface

```js
fulfill(acceptOrder(submittedJsonText))
```

The Order intake module still exposes just `acceptOrder`, intentionally leaving fulfillment outside its implementation. It makes the dominant caller path trivial while keeping fulfillment effects and choices local to fulfillment.

Its interface is nearly the same as the minimal design, but its seam placement is explicitly justified: immediately before the accepted Order is handed to fulfillment. It avoids absorbing unrelated fulfillment behavior.

Comparison: Designs 1 and 3 are deepest for the current cluster—one operation hides all intake sequencing and concentrates verification at one seam. Design 2 spreads knowledge across construction and preparation adapters, gaining flexibility but losing present-day locality. All current dependencies are in-process, so no external adapter is warranted.

My recommendation is the minimal/common-caller hybrid: retain a single synchronous `acceptOrder(submittedJsonText)` interface, document its ordering and error modes, and keep parsing, validation, and canonicalization private implementation detail. Test through that seam and retire stage-level tests if this were implemented. Defer the preparation catalog until a second concrete Order form proves that secondary seam necessary.

One decision-to-implementation gap surfaced: ADR 0001 requires uppercase ISO currency codes, but current behavior only uppercases whatever string is supplied; it does not validate ISO membership. That should remain unchanged unless separately agreed as a behavior change.

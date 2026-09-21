# Stellar Adaptive Seed

Status target: **WIRED after assembly/build verification. VERIFIED only after an installed APK exercises the growth loop end to end.**

## Seed

The visible initial system is intentionally small:

- Social
- Stellar Proximology Lab
- Paper
- Auto Builder

A world, store, scheduler, CRM, marketing page, or other capability is **not** assumed to exist at startup.

## Growth contract

The adaptive layer follows this order:

1. observe a user need or repeated pattern;
2. prefer extending an existing mechanism;
3. prefer composing existing mechanisms before creating another one;
4. create a proposal and sandbox manifest;
5. keep behavioral activation under user control;
6. activate only after explicit approval;
7. record a receipt;
8. preserve rollback history.

Generated pages are outputs of the growth system, not the substrate.

## Three growth classes

- **Structural:** page, service, tool, workspace, store, world, scheduler, analytics surface.
- **Behavioral:** routing, follow-up, recommendation, automation, agent/tool choice.
- **Knowledge:** observed outcomes, typed feedback, preferences, useful relationships.

## Social continuity

The adaptive Social surface does not create a second competing social engine.

Posts and typed feedback are also written into the existing canonical `ResonanceNetwork` as addressable graph observations with local evidence metadata. If that graph write fails, the adaptive layer records an explicit failure event instead of reporting a successful integration.

The richer existing Resonance Network profile, pod, matching, and relationship machinery remains the donor authority.

## Builder honesty boundary

A generated page is not automatically treated as a wired capability.

The Builder records:

- `wiredBehaviors` when a behavior is backed by a built-in implementation or registered runtime adapter;
- `pendingBehaviors` when a requested behavior has only a generated workspace/UI and still needs an implementation.

This preserves the project's PRESENT / PARTIALLY WIRED / WIRED distinction inside the runtime itself.

## Market core

The market primitives exist from the beginning but the Market page stays hidden until commerce creates a real need.

Primitives:

- offer
- request
- match
- agreement
- fulfillment
- receipt
- typed feedback
- contribution
- revenue pool

The matching socket includes ordinary evidence now: demonstrated skill, availability, project history, typed feedback, and text/need overlap.

The implemented local lifecycle is:

`offer -> request -> candidate match -> explicit agreement -> fulfillment -> receipt`

Candidate matching never creates an agreement automatically. Agreement creation is an explicit action.

Runtime adapters can extend generated capabilities without replacing the adaptive core. The HD matcher is one such reserved adapter socket.

### Human Design boundary

An `hd-matcher` socket is reserved but **inactive**. The adaptive seed does not invent Human Design matching rules. It can be activated later only when the canonical HD system is deliberately introduced.

## Revenue

Revenue can be recorded immediately, but it stays **unallocated** until the user defines an allocation rule. The implementation deliberately does not invent percentages.

This supports the intended future-product loop without silently deciding how money is distributed.

## Advertising and planning

The Marketing Planner may create internal campaign plans and learn from measured outcomes.

External actions remain separate permissions:

- publish externally
- spend money
- message people
- change prices
- commit appointments

Planning is not treated as authorization to act.

## Receipts

Adaptive events persist in local state. When the Android workspace bridge is available, each event is also written as an individual JSON receipt beneath:

`adaptive/receipts/`

Rollback disables generated behavior/pages while preserving the event history.

## Verification boundary

Build-time verification proves:

- the adaptive module is present in the assembled app;
- it loads after the canonical local Lab;
- all four seed apps are represented;
- market/revenue/typed-feedback cores are present;
- HD matching remains reserved/inactive;
- proposal, sandbox, approval, activation, rollback, gap scan, planning, and receipt paths exist;
- Node parses the module;
- the APK still packages through the existing Stellar build chamber.

Device-level **VERIFIED** requires exercising at least:

1. open Social and create a typed interaction;
2. create a Paper artifact;
3. send it to Builder;
4. build a sandbox;
5. approve/activate the proposal;
6. observe the generated capability;
7. rollback it and confirm history remains;
8. create a commerce need and confirm Market becomes visible only after activation;
9. confirm a receipt is persisted in the Android workspace.

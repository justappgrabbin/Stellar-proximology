# Planning Census

Branch: `stellar-computer-assembly`

## Self-hosted planning pieces already present

The assembly does not need a brand-new planning brain.

### Synthia / ato-core SuccessLedger
Source:
`Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip/vendor/ato-core/src/success.mjs`

Already provides:
- purpose definition
- weighted success indicators
- progress observations
- direction/trend calculation
- support proposals
- summary/replay

### StellarCPU HumanSuccessMetabolism
Source:
`StellarCPU-Rough-v0.1.0.zip/packages/human-success/human-success-metabolism.mjs`

Already provides:
- self-defined human-success tracking
- five success dimensions
- evidence-counted fitness
- strategy fitness
- adaptation pressure
- separation between user outcome and Synthia task completion

### Synthia ResearchOrgan
Already turns an intent into:
- local research project
- working claim
- hypothesis
- experiment protocol
- local research snapshot

### Synthia BrowserPlanningOrgan
Already provides:
- navigation workflow planning
- form workflow planning
- purchase workflow planning
- booking workflow planning
- human-only / binding-action pauses
- outcome verification hooks

## Goal-Oriented Inference archive

`Building an AI Inference Engine for Goal-Oriented Tasks.zip` is preserved as an existing planning application/reference.

Its supplied source contains:
- goal sessions
- messages
- knowledge map
- implementation plans
- plan export UI
- tests for session/chat/plan flows

However, the supplied archive is not the preferred self-hosted runtime in its present form because the extracted code is tied to:
- Manus-style OAuth/user context
- MySQL / Drizzle persistence
- an `invokeLLM` backend abstraction
- framework files that are not all present in this partial archive

Nothing has been deleted or rewritten. It remains available as a planning UI/data-model source, but local planning currently binds the already-self-contained Synthia/Stellar mechanisms first.

## Current self-hosted planning binding

`Stellar Comp -> Local Planning provider -> SuccessLedger + HumanSuccessMetabolism + Synthia ResearchOrgan + BrowserPlanningOrgan`

This is a coordination adapter around existing implementations, not a replacement planner.

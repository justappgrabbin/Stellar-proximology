# Opportunity & Consent Assembly Binding

This pass attaches the existing Synthia MCP Opportunity & Consent package to the Stellar Comp capability bus.

No second opportunity system is introduced.

Existing package resolution order is preserved:

`local -> organism -> network -> MCP -> human`

Existing package boundaries are also preserved:

- collaboration consent and installation consent are separate;
- deployment requires a valid installation token;
- device owner must match the consent subject;
- package must be allowlisted;
- an authorized provisioner must exist;
- the core does not silently install software.

The assembly provider exposes those existing behaviors without weakening them.

The package's own supplied test suite was executed during this pass:

- 6 tests
- 6 passed
- 0 failed

That verifies the source package itself. The committed assembly test reproduces the Stellar Comp binding after the package is staged.

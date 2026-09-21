# Plan to Stellar Project Flow

This integration flow does not create another project system.

It connects the existing local planning state to the existing Stellar Proximology project API through the existing Stellar Comp capability bus.

Path:

`planning.summary -> stellar.project.create -> stellar.project.get`

The flow requires an explicit promotion call. It does not automatically turn every thought or plan into a project.

The local planning layer remains the source of purpose/progress context. Stellar Proximology remains the owner of the project record.

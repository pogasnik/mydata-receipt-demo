# AADE myDATA XSD files (v2.0.2)

These five files are the official AADE myDATA schemas, **version 2.0.2**, downloaded
unmodified from the AADE website (https://www.aade.gr/mydata, "Τεχνικές
Προδιαγραφές" → myDATA REST API v2.0.2). They are vendored here only so the tests can
validate generated XML offline.

| File                                 | Role                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| `InvoicesDoc-v2.0.2.xsd`             | Main schema: root element `InvoicesDoc`                |
| `SimpleTypes-v2.0.2.xsd`             | Shared simple types (amounts, VAT codes, enumerations) |
| `incomeClassification-v2.0.2.xsd`    | `icls:` income classification types                    |
| `expensesClassification-v2.0.2.xsd`  | `ecls:` expenses classification types                  |
| `TransportTypes-v2.0.2.xsd`          | Delivery-note types, imported by the main schema       |

`InvoicesDoc-v2.0.2.xsd` is passed to the validator as the schema and the other four
as `preload`, because the main schema `xs:import`s / `xs:include`s them by file name.

After changing any file here, run `pnpm --filter @pogasnik/mydata-xml embed-xsd`
(the build does this automatically). A test fails if `src/generated/xsd.ts` is out of
sync with these files.

SHA-256:

```
686769176906d2ebac20471818a554dd49222073ddbc1affce16c1f8c20b1b79  InvoicesDoc-v2.0.2.xsd
a8a584950e413720124cefc2d63c26147cbf5918a196a65bd6a1677962b5946c  SimpleTypes-v2.0.2.xsd
2bda8e82a9b71eb6c06d9caf8ecc92a3688338cc18475fbfe42d07134e9e91fb  incomeClassification-v2.0.2.xsd
926f705ef83d3aef1d03676e83067761e5beff47316e3de3621c8d54b641507c  expensesClassification-v2.0.2.xsd
db08dd06c2293ee5ef9dd9e32425124726a5544c6bc253dd6a267afdc799bcfa  TransportTypes-v2.0.2.xsd
```

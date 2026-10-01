# @pogasnik/mydata-xml

Typed builder, strict parser and XSD validator for AADE myDATA `InvoicesDoc` XML (schema
v2.0.2), for document types 11.1 (retail receipt) and 1.1 (sales invoice). No network code:
it builds, validates and parses XML only.

- `buildInvoicesDocXml(input, options?)`: validates the input, computes amounts in integer cents
  and returns the XML (elements in the XSD's `xs:sequence` order).
- `parseInvoicesDocXml(xml)`: returns a typed `MyDataDocument` and rejects inconsistent XML.
- `validateInput(input)`: every input problem as `{ path, message }`, without throwing.
- `validateInvoicesDocXml(xml)` from `@pogasnik/mydata-xml/validate`: validates against the
  vendored official XSD with libxml2 compiled to WebAssembly (Node and browser).

Rounding rule, scope and limits: see the [repository README](../../README.md).

Copyright © 2026 Nikolaos Pogas. All rights reserved. Not licensed for use; published for
viewing only.

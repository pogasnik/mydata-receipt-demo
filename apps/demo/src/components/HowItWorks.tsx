const STEPS = [
  { el: 'Φόρμα', en: 'Form', code: 'FormState' },
  { el: 'Τυποποιημένη είσοδος', en: 'Typed input', code: 'DocumentInput' },
  { el: 'XML (έλεγχος XSD)', en: 'XML, XSD-validated', code: 'buildInvoicesDocXml' },
  { el: 'Ανάγνωση', en: 'Parse', code: 'parseInvoicesDocXml' },
  { el: 'PDF', en: 'PDF', code: '@react-pdf/renderer' },
] as const;

export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title" className="how-title">
        Πώς λειτουργεί <span className="label-en">How it works</span>
      </h2>
      <ol className="how-steps">
        {STEPS.map((step) => (
          <li key={step.code}>
            <span lang="el">{step.el}</span>
            <span className="label-en">{step.en}</span>
            <code>{step.code}</code>
          </li>
        ))}
      </ol>
      <p className="how-note">
        Το PDF παράγεται από το XML, όχι από τη φόρμα: το XML είναι η μοναδική πηγή αλήθειας.{' '}
        <span className="label-en">
          The PDF is generated from the XML, not from the form state: the XML is the source of
          truth.
        </span>
      </p>
    </section>
  );
}

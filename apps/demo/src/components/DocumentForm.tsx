import {
  DOCUMENT_TYPES,
  MEASUREMENT_UNITS,
  PAYMENT_METHODS,
  VAT_CATEGORIES,
  VAT_EXEMPTION_MAX,
  VAT_EXEMPTION_MIN,
  type DocumentType,
  type InputIssue,
  type MeasurementUnit,
  type PaymentMethod,
  type VatCategory,
} from '@pogasnik/mydata-xml';
import { useId } from 'react';
import {
  describeIssue,
  issueLocation,
  lineFromPreset,
  newLineId,
  PRESETS,
  withDocumentType,
  type FormState,
  type LineDraft,
} from '@/lib/form-state';
import { formatEuro } from '@/lib/format';
import { DEMO_BUYER, LETTERHEAD } from '@/receipt/letterhead';
import { Label } from './Label';

const VAT_OPTIONS = Object.entries(VAT_CATEGORIES).map(([code, { label }]) => ({
  code: Number(code) as VatCategory,
  label,
}));
const UNIT_OPTIONS = Object.entries(MEASUREMENT_UNITS).map(([code, unit]) => ({
  code: Number(code) as MeasurementUnit,
  label: unit.el,
}));
const EXEMPTION_CODES = Array.from(
  { length: VAT_EXEMPTION_MAX - VAT_EXEMPTION_MIN + 1 },
  (_, i) => VAT_EXEMPTION_MIN + i,
);

interface Props {
  state: FormState;
  onChange: (next: FormState) => void;
  issues: readonly InputIssue[];
}

export function DocumentForm({ state, onChange, issues }: Props) {
  const id = useId();
  const spec = DOCUMENT_TYPES[state.documentType];
  const errorFor = (path: string) => {
    const issue = issues.find((i) => i.path === path);
    return issue && describeIssue(issue);
  };
  const lineErrors = (index: number) =>
    issues.filter((issue) => issueLocation(issue).line === index);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    onChange({ ...state, [key]: value });
  };
  const updateLine = (lineId: string, patch: Partial<LineDraft>) => {
    set(
      'lines',
      state.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  };

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
      noValidate
    >
      <fieldset className="segmented">
        <legend>
          <Label el="Είδος παραστατικού" en="Document type" />
        </legend>
        {(Object.keys(DOCUMENT_TYPES) as DocumentType[]).map((type) => (
          <label key={type} className="segment">
            <input
              type="radio"
              name={`${id}-type`}
              value={type}
              checked={state.documentType === type}
              onChange={() => {
                onChange(withDocumentType(state, type));
              }}
            />
            <span>
              <strong>{type}</strong> {DOCUMENT_TYPES[type].el}
              <span className="label-en">{DOCUMENT_TYPES[type].en}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid-3">
        <Field label={<Label el="Σειρά" en="Series" />} error={errorFor('series')}>
          <input
            value={state.series}
            maxLength={50}
            onChange={(e) => {
              set('series', e.target.value);
            }}
          />
        </Field>
        <Field label={<Label el="Α/Α" en="Number" />} error={errorFor('aa')}>
          <input
            value={state.aa}
            maxLength={50}
            inputMode="numeric"
            onChange={(e) => {
              set('aa', e.target.value);
            }}
          />
        </Field>
        <Field label={<Label el="Ημερομηνία" en="Issue date" />} error={errorFor('issueDate')}>
          <input
            type="date"
            value={state.issueDate}
            onChange={(e) => {
              set('issueDate', e.target.value);
            }}
          />
        </Field>
      </div>

      <Field label={<Label el="Τρόπος πληρωμής" en="Payment method" />}>
        <select
          value={state.paymentMethod}
          onChange={(e) => {
            set('paymentMethod', Number(e.target.value) as PaymentMethod);
          }}
        >
          {spec.paymentMethods.map((code) => (
            <option key={code} value={code}>
              {PAYMENT_METHODS[code].el} · {PAYMENT_METHODS[code].en} ({code})
            </option>
          ))}
        </select>
      </Field>

      {spec.counterpart === 'required' && (
        <div className="buyer-card">
          <Label el="Πελάτης (σταθερός, φανταστικός)" en="Buyer (fixed, fictional)" />
          <p>
            {LETTERHEAD[DEMO_BUYER.vatNumber]?.name} · ΑΦΜ {DEMO_BUYER.vatNumber}
            <br />
            {DEMO_BUYER.address.street} {DEMO_BUYER.address.number}, {DEMO_BUYER.address.postalCode}{' '}
            {DEMO_BUYER.address.city}
          </p>
        </div>
      )}

      <fieldset className="lines">
        <legend>
          <Label el="Γραμμές" en="Lines" />
        </legend>
        <p className="hint">
          {spec.pricing === 'gross'
            ? 'Οι τιμές περιλαμβάνουν ΦΠΑ · Prices include VAT'
            : 'Οι τιμές είναι χωρίς ΦΠΑ · Prices exclude VAT'}
        </p>

        <div className="presets" role="group" aria-label="Έτοιμα προϊόντα / Sample products">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="chip"
              onClick={() => {
                set('lines', [...state.lines, lineFromPreset(preset)]);
              }}
            >
              + {preset.name} {preset.unitPrice} € / {VAT_CATEGORIES[preset.vatCategory].label}
            </button>
          ))}
        </div>

        {state.lines.map((line, index) => (
          <LineRow
            key={line.id}
            line={line}
            index={index}
            errors={lineErrors(index)}
            onChange={(patch) => {
              updateLine(line.id, patch);
            }}
            onRemove={() => {
              set(
                'lines',
                state.lines.filter((other) => other.id !== line.id),
              );
            }}
          />
        ))}
        {errorFor('lines') && <p className="error">{errorFor('lines')}</p>}

        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            set('lines', [
              ...state.lines,
              {
                id: newLineId(),
                name: '',
                quantity: '1',
                unitPrice: '',
                measurementUnit: 1,
                vatCategory: 1,
                vatExemptionCategory: 1,
              },
            ]);
          }}
        >
          + Προσθήκη γραμμής <span className="label-en">Add line</span>
        </button>
      </fieldset>
    </form>
  );
}

function LineRow({
  line,
  index,
  errors,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  index: number;
  errors: readonly InputIssue[];
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  const errorFor = (field: string) => {
    const issue = errors.find((i) => issueLocation(i).field === field);
    return issue && describeIssue(issue);
  };
  return (
    <div className="line" aria-label={`Γραμμή ${index + 1} / Line ${index + 1}`} role="group">
      <Field
        className="line-name"
        label={<Label el="Περιγραφή" en="Description" />}
        error={errorFor('name')}
      >
        <input
          value={line.name}
          maxLength={300}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
        />
      </Field>
      <Field label={<Label el="Ποσότητα" en="Qty" />} error={errorFor('quantity')}>
        <input
          value={line.quantity}
          inputMode="decimal"
          onChange={(e) => {
            onChange({ quantity: e.target.value });
          }}
        />
      </Field>
      <Field label={<Label el="Μονάδα" en="Unit" />}>
        <select
          value={line.measurementUnit}
          onChange={(e) => {
            onChange({ measurementUnit: Number(e.target.value) as MeasurementUnit });
          }}
        >
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit.code} value={unit.code}>
              {unit.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={<Label el="Τιμή €" en="Unit price" />} error={errorFor('unitPriceCents')}>
        <input
          value={line.unitPrice}
          inputMode="decimal"
          placeholder="0,00"
          onChange={(e) => {
            onChange({ unitPrice: e.target.value });
          }}
        />
      </Field>
      <Field label={<Label el="ΦΠΑ" en="VAT" />}>
        <select
          value={line.vatCategory}
          onChange={(e) => {
            onChange({ vatCategory: Number(e.target.value) as VatCategory });
          }}
        >
          {VAT_OPTIONS.map((vat) => (
            <option key={vat.code} value={vat.code}>
              {vat.label}
            </option>
          ))}
        </select>
      </Field>
      {line.vatCategory === 7 && (
        <Field
          label={<Label el="Αιτία εξαίρεσης" en="Exemption (§8.3)" />}
          error={errorFor('vatExemptionCategory')}
        >
          <select
            value={line.vatExemptionCategory}
            onChange={(e) => {
              onChange({ vatExemptionCategory: Number(e.target.value) });
            }}
          >
            {EXEMPTION_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
      )}
      <button
        type="button"
        className="line-remove"
        onClick={onRemove}
        aria-label={`Αφαίρεση γραμμής ${index + 1} / Remove line ${index + 1}`}
        title="Αφαίρεση / Remove"
      >
        ×
      </button>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  error?: string | undefined;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <label className={`field ${error ? 'field-invalid' : ''} ${className ?? ''}`}>
      {label}
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  );
}

export function VatTotals({
  rows,
  total,
}: {
  rows: readonly { ratePercent: number; netCents: number; vatCents: number; grossCents: number }[];
  total: { netCents: number; vatCents: number; grossCents: number };
}) {
  return (
    <section className="card" aria-labelledby="totals-title">
      <h2 id="totals-title" className="card-title">
        <Label el="Σύνολα ανά συντελεστή ΦΠΑ" en="Totals per VAT rate, read back from the XML" />
      </h2>
      <table className="totals">
        <thead>
          <tr>
            <th scope="col">ΦΠΑ · VAT</th>
            <th scope="col">Καθαρή · Net</th>
            <th scope="col">ΦΠΑ · VAT</th>
            <th scope="col">Σύνολο · Gross</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ratePercent}>
              <th scope="row">{row.ratePercent}%</th>
              <td>{formatEuro(row.netCents)}</td>
              <td>{formatEuro(row.vatCents)}</td>
              <td>{formatEuro(row.grossCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Σύνολο</th>
            <td>{formatEuro(total.netCents)}</td>
            <td>{formatEuro(total.vatCents)}</td>
            <td>{formatEuro(total.grossCents)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

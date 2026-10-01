import { WATERMARK, WATERMARK_EL, WATERMARK_EN, type ReceiptView } from '@/receipt/view-model';

/** HTML rendering of the same view model the PDF uses. */
export function ReceiptPreview({ view }: { view: ReceiptView }) {
  return (
    <article className="paper" aria-label={`${view.title} (${WATERMARK_EN})`}>
      <div className="paper-watermark" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          // Each row repeats the text so it spans the whole rotated layer.
          <span key={i}>{`${WATERMARK} · ${WATERMARK} · ${WATERMARK}`}</span>
        ))}
      </div>

      <p className="paper-banner">
        {WATERMARK_EL}
        <br />
        {WATERMARK_EN}
      </p>

      <header className="paper-center">
        <p className="paper-issuer">{view.issuer.name}</p>
        {view.issuer.lines.map((line) => (
          <p key={line} className="paper-muted">
            {line}
          </p>
        ))}
      </header>

      <hr />
      <p className="paper-title">{view.title}</p>
      <p className="paper-center paper-muted">{view.subtitle}</p>
      <hr />

      <dl className="paper-rows">
        {view.meta.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {view.buyer && (
        <section className="paper-buyer">
          <p className="paper-strong">Πελάτης / Customer</p>
          <p>{view.buyer.name}</p>
          {view.buyer.lines.map((line) => (
            <p key={line} className="paper-muted">
              {line}
            </p>
          ))}
        </section>
      )}

      <hr />
      <ul className="paper-lines">
        {view.lines.map((line) => (
          <li key={line.key}>
            <span>{line.description}</span>
            <span className="paper-strong">{line.amount}</span>
            <small>{line.detail}</small>
          </li>
        ))}
      </ul>
      <p className="paper-small paper-muted">{view.amountsInclude}</p>

      <hr />
      <table className="paper-vat">
        <thead>
          <tr>
            <th scope="col">ΦΠΑ</th>
            <th scope="col">Καθαρή</th>
            <th scope="col">ΦΠΑ</th>
            <th scope="col">Σύνολο</th>
          </tr>
        </thead>
        <tbody>
          {view.vatRows.map((row) => (
            <tr key={row.rate}>
              <th scope="row">{row.rate}</th>
              <td>{row.net}</td>
              <td>{row.vat}</td>
              <td>{row.gross}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr />
      <dl className="paper-rows">
        {view.totals.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className="paper-grand">
          <dt>ΣΥΝΟΛΟ / TOTAL</dt>
          <dd>{view.grandTotal}</dd>
        </div>
        <div>
          <dt>Πληρωμή / Payment</dt>
          <dd>{view.payment}</dd>
        </div>
      </dl>

      <hr />
      <dl className="paper-rows">
        <div>
          <dt>MARK</dt>
          <dd>{view.mark}</dd>
        </div>
        <div>
          <dt>UID</dt>
          <dd>{view.uid}</dd>
        </div>
      </dl>
      <div className="paper-qr" aria-label="QR code placeholder (not issued)">
        QR
      </div>

      <p className="paper-footer">{WATERMARK}</p>
    </article>
  );
}

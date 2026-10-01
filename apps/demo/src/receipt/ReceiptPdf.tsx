import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { WATERMARK, WATERMARK_EL, WATERMARK_EN, type ReceiptView } from './view-model';

const FAMILY = 'Noto Sans';
let registeredBase: string | null = null;

/**
 * Embeds Noto Sans (SIL OFL), which has Greek glyphs. The built-in PDF fonts
 * (Helvetica etc.) only cover Latin-1, so Greek text would render as blanks.
 */
export function registerFonts(baseUrl: string): void {
  if (registeredBase === baseUrl) return;
  Font.register({
    family: FAMILY,
    fonts: [
      { src: `${baseUrl}/NotoSans-Regular.ttf`, fontWeight: 400 },
      { src: `${baseUrl}/NotoSans-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Greek words must not be split with Latin hyphenation rules.
  Font.registerHyphenationCallback((word) => [word]);
  registeredBase = baseUrl;
}

const INK = '#111111';
const MUTED = '#555555';
const RED = '#b3261e';

const s = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 7.5, color: INK, padding: 10, paddingBottom: 14 },
  watermarkLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  watermarkRow: {
    position: 'absolute',
    left: -80,
    width: 400,
    fontSize: 8,
    fontWeight: 700,
    color: RED,
    opacity: 0.16,
    transform: 'rotate(-32deg)',
  },
  banner: {
    borderWidth: 1,
    borderColor: RED,
    color: RED,
    padding: 3,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 7,
  },
  center: { textAlign: 'center' },
  issuerName: { fontSize: 11, fontWeight: 700, textAlign: 'center' },
  muted: { color: MUTED },
  rule: {
    borderBottomWidth: 0.6,
    borderBottomColor: INK,
    borderStyle: 'dashed',
    marginVertical: 5,
  },
  title: { fontSize: 9, fontWeight: 700, textAlign: 'center', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: MUTED },
  bold: { fontWeight: 700 },
  sectionLabel: { fontWeight: 700, marginBottom: 1 },
  line: { marginBottom: 3 },
  lineDetail: { color: MUTED, fontSize: 6.5 },
  vatHead: { flexDirection: 'row', color: MUTED, fontSize: 6.5 },
  vatRow: { flexDirection: 'row', fontSize: 6.5 },
  vatRate: { width: '16%' },
  vatCell: { width: '28%', textAlign: 'right' },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 10,
    fontWeight: 700,
    marginTop: 3,
  },
  qrBox: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: MUTED,
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  qrText: { textAlign: 'center', color: MUTED, fontSize: 10, fontWeight: 700 },
  footer: { marginTop: 8, textAlign: 'center', color: RED, fontWeight: 700, fontSize: 6.5 },
});

/** Enough rows to cover any realistic receipt; rows past the page end are clipped. */
const WATERMARK_ROWS = Array.from({ length: 60 }, (_, i) => i);

/** 80 mm thermal-receipt width; height grows with the content. */
export function ReceiptPdf({ view }: { view: ReceiptView }) {
  return (
    <Document title={`${view.title} (DEMO)`} author="Demo Shop (fictional)" subject={WATERMARK}>
      <Page size={{ width: '80mm' }} style={s.page} wrap={false}>
        <View style={s.watermarkLayer}>
          {WATERMARK_ROWS.map((i) => (
            <Text key={i} style={[s.watermarkRow, { top: i * 46 }]}>
              {WATERMARK}
            </Text>
          ))}
        </View>

        <Text style={s.banner}>
          {WATERMARK_EL}
          {'\n'}
          {WATERMARK_EN}
        </Text>

        <Text style={s.issuerName}>{view.issuer.name}</Text>
        {view.issuer.lines.map((line) => (
          <Text key={line} style={[s.center, s.muted]}>
            {line}
          </Text>
        ))}

        <View style={s.rule} />
        <Text style={s.title}>{view.title}</Text>
        <Text style={[s.center, s.muted]}>{view.subtitle}</Text>
        <View style={s.rule} />

        {view.meta.map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text>{value}</Text>
          </View>
        ))}

        {view.buyer && (
          <View style={{ marginTop: 4 }}>
            <Text style={s.sectionLabel}>Πελάτης / Customer</Text>
            <Text>{view.buyer.name}</Text>
            {view.buyer.lines.map((line) => (
              <Text key={line} style={s.muted}>
                {line}
              </Text>
            ))}
          </View>
        )}

        <View style={s.rule} />
        {view.lines.map((line) => (
          <View key={line.key} style={s.line} wrap={false}>
            <View style={s.row}>
              <Text style={{ flex: 1, paddingRight: 6 }}>{line.description}</Text>
              <Text style={s.bold}>{line.amount}</Text>
            </View>
            <Text style={s.lineDetail}>{line.detail}</Text>
          </View>
        ))}
        <Text style={s.lineDetail}>{view.amountsInclude}</Text>

        <View style={s.rule} />
        <View style={s.vatHead}>
          <Text style={s.vatRate}>ΦΠΑ</Text>
          <Text style={s.vatCell}>Καθαρή</Text>
          <Text style={s.vatCell}>ΦΠΑ</Text>
          <Text style={s.vatCell}>Σύνολο</Text>
        </View>
        {view.vatRows.map((row) => (
          <View key={row.rate} style={s.vatRow}>
            <Text style={s.vatRate}>{row.rate}</Text>
            <Text style={s.vatCell}>{row.net}</Text>
            <Text style={s.vatCell}>{row.vat}</Text>
            <Text style={s.vatCell}>{row.gross}</Text>
          </View>
        ))}

        <View style={s.rule} />
        {view.totals.map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text>{value}</Text>
          </View>
        ))}
        <View style={s.grand}>
          <Text>ΣΥΝΟΛΟ / TOTAL</Text>
          <Text>{view.grandTotal}</Text>
        </View>
        <View style={[s.row, { marginTop: 2 }]}>
          <Text style={s.label}>Πληρωμή / Payment</Text>
          <Text>{view.payment}</Text>
        </View>

        <View style={s.rule} />
        <View style={s.row}>
          <Text style={s.label}>MARK</Text>
          <Text>{view.mark}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>UID</Text>
          <Text>{view.uid}</Text>
        </View>
        <View style={s.qrBox}>
          <Text style={s.qrText}>QR</Text>
        </View>

        <Text style={s.footer}>{WATERMARK}</Text>
      </Page>
    </Document>
  );
}

import { MEASUREMENT_UNITS, type MeasurementUnit } from '@pogasnik/mydata-xml';

const euro = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' });
const decimal = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 3 });

/** 1234 → "12,34 €" */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

/** 0.5, 2 → "0,5 kg" */
export function formatQuantity(quantity: number, unit: MeasurementUnit): string {
  return `${decimal.format(quantity)} ${MEASUREMENT_UNITS[unit].short}`;
}

/** "2026-10-01" → "01/10/2026" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}

/**
 * Greek all-caps drops the tonos ("Τιμολόγιο" → "ΤΙΜΟΛΟΓΙΟ"); String#toUpperCase
 * keeps it ("ΤΙΜΟΛΌΓΙΟ"). Dialytika stay, as Greek orthography requires.
 */
export function greekUpperCase(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .toUpperCase()
    .normalize('NFC');
}

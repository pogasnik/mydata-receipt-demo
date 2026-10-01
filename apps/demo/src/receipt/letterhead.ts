import type { CounterpartInput, IssuerInput } from '@pogasnik/mydata-xml';

/**
 * Display data that myDATA does not carry for Greek entities.
 *
 * Spec §5.1 note 3: for a GR issuer, name and address are NOT accepted in the
 * XML; for a GR counterpart, the name is NOT accepted. A real system looks these
 * up by ΑΦΜ in its own master data, so the printout combines this "letterhead"
 * profile with the XML.
 *
 * Everything here is fictional. 000000000 and 999999999 are not real ΑΦΜ.
 */
export interface LetterheadEntry {
  readonly name: string;
  /** Printed address. Only used for the issuer; a counterpart's comes from the XML. */
  readonly addressLines?: readonly string[];
}

export const DEMO_ISSUER: IssuerInput = { vatNumber: '000000000', country: 'GR', branch: 0 };

export const DEMO_BUYER: CounterpartInput = {
  vatNumber: '999999999',
  country: 'GR',
  branch: 0,
  address: { street: 'Οδός Δοκιμής', number: '10', postalCode: '00000', city: 'Δειγματούπολη' },
};

export const LETTERHEAD: Readonly<Record<string, LetterheadEntry>> = {
  [DEMO_ISSUER.vatNumber]: {
    name: 'Demo Shop',
    addressLines: ['Οδός Παραδείγματος 1', '00000 Δειγματούπολη'],
  },
  [DEMO_BUYER.vatNumber]: { name: 'Demo Πελάτης Α.Ε. (φανταστικός)' },
};

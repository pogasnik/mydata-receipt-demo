import { DemoLoader } from '@/components/DemoLoader';

export default function Page() {
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <p className="eyebrow">AADE myDATA · InvoicesDoc v2.0.2 · 11.1 &amp; 1.1</p>
          <h1>
            myDATA XML → Απόδειξη
            <span className="label-en">Typed XML builder, rendered to a printable receipt</span>
          </h1>
          <p className="notice" role="note">
            <strong>Μόνο επίδειξη.</strong> Τίποτα δεν αποστέλλεται στην ΑΑΔΕ· όλα γίνονται στον
            browser σας. Ο εκδότης και ο πελάτης είναι φανταστικοί.{' '}
            <span className="label-en">
              Demo only. Nothing is sent to AADE or anywhere else; everything runs in your browser.
              Issuer and buyer are fictional.
            </span>
          </p>
        </div>
      </header>

      <main className="main">
        <DemoLoader />
      </main>

      <footer className="site-footer">
        <p>
          © 2026 Nikolaos Pogas. All rights reserved. Source published for viewing only.{' '}
          <a href="https://github.com/pogasnik">github.com/pogasnik</a>
        </p>
        <p className="label-en">
          Font: Noto Sans (SIL Open Font License). XSD: AADE myDATA v2.0.2. Not affiliated with
          AADE.
        </p>
      </footer>
    </>
  );
}

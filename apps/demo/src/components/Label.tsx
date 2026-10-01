/** Greek label with an English sublabel, used throughout the UI. */
export function Label({ el, en }: { el: string; en: string }) {
  return (
    <span className="label">
      <span lang="el">{el}</span>
      <span className="label-en" lang="en">
        {en}
      </span>
    </span>
  );
}

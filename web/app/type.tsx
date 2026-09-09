"use client";

/**
 * A heading that assembles itself, letter by letter.
 *
 * The text is kept whole in an aria-label so a screen reader hears a sentence
 * rather than a column of single characters; the visible letters are hidden
 * from it. Whitespace uses a non-breaking space so a hidden line break on a
 * phone still leaves a gap between words.
 */
export function Typed({ text, cursor = false, delay = 0 }: { text: string; cursor?: boolean; delay?: number }) {
  return (
    <span className="type" aria-label={text}>
      {[...text].map((c, i) => (
        <span key={`${c}${i}`} aria-hidden style={{ animationDelay: `${delay + i * 26}ms` }}>
          {c === " " ? " " : c}
        </span>
      ))}
      {cursor && <i className="type-cur" aria-hidden style={{ animationDelay: `${delay + text.length * 26}ms` }} />}
    </span>
  );
}

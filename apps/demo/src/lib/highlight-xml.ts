export type XmlTokenKind = 'declaration' | 'punctuation' | 'tag' | 'attribute' | 'value' | 'text';

export interface XmlToken {
  readonly kind: XmlTokenKind;
  readonly text: string;
}

const MARKUP = /(<\?[\s\S]*?\?>)|(<\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)(\s*\/?>)|([^<]+)|(<)/g;
const ATTRIBUTE = /(\s+)([\w:.-]+)(=)("[^"]*")/g;

/**
 * Splits XML into tokens for syntax highlighting. Rendering the tokens as text
 * nodes (never as HTML) keeps the output safe whatever the XML contains.
 * Concatenating every token's text always reproduces the input exactly.
 */
export function tokenizeXml(xml: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  const push = (kind: XmlTokenKind, text: string | undefined) => {
    if (text) tokens.push({ kind, text });
  };
  for (const match of xml.matchAll(MARKUP)) {
    const [, declaration, open, name, attributes, close, text, stray] = match;
    if (declaration) push('declaration', declaration);
    else if (name) {
      push('punctuation', open);
      push('tag', name);
      for (const [, space, attribute, equals, value] of (attributes ?? '').matchAll(ATTRIBUTE)) {
        push('text', space);
        push('attribute', attribute);
        push('punctuation', equals);
        push('value', value);
      }
      push('punctuation', close);
    } else push('text', text ?? stray);
  }
  return tokens;
}

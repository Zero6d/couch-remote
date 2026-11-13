/**
 * Minimal parser for Valve's KeyValues text format (libraryfolders.vdf, appmanifest_*.acf).
 * Every value is a string or a nested object; comments and escapes are not needed for these files.
 */
export type VdfValue = string | VdfObject;
export interface VdfObject {
  [key: string]: VdfValue;
}

export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text);
  let pos = 0;

  function parseObject(): VdfObject {
    const obj: VdfObject = {};
    while (pos < tokens.length) {
      const tok = tokens[pos++];
      if (tok === '}') return obj;
      const key = tok;
      const next = tokens[pos++];
      if (next === '{') {
        obj[key] = parseObject();
      } else if (next === undefined) {
        throw new Error(`VDF: missing value for key "${key}"`);
      } else {
        obj[key] = next;
      }
    }
    return obj;
  }

  return parseObject();
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < text.length) {
          value += text[j + 1];
          j += 2;
        } else {
          value += text[j++];
        }
      }
      tokens.push(value);
      i = j + 1;
    } else if (ch === '{' || ch === '}') {
      tokens.push(ch);
      i++;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else {
      i++;
    }
  }
  return tokens;
}

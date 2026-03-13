function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  let cursor = index - 1;

  while (cursor >= 0 && text[cursor] === "\\") {
    backslashes += 1;
    cursor -= 1;
  }

  return backslashes % 2 === 1;
}

function stripComments(text: string): string {
  let result = "";
  let inString = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === '"' && !isEscaped(text, index)) {
      inString = !inString;
      result += char;
      index += 1;
      continue;
    }

    if (inString) {
      result += char;
      index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && text[index + 1] === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        index += 1;
      }
      if (index < text.length) {
        index += 2;
      }
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

function removeTrailingCommas(text: string): string {
  let result = "";
  let inString = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"' && !isEscaped(text, index)) {
      inString = !inString;
      result += char;
      continue;
    }

    if (!inString && char === ",") {
      let lookahead = index + 1;
      while (lookahead < text.length && /\s/.test(text[lookahead])) {
        lookahead += 1;
      }

      if (text[lookahead] === "}" || text[lookahead] === "]") {
        continue;
      }
    }

    result += char;
  }

  return result;
}

export function parseJsonc(text: string): unknown {
  return JSON.parse(removeTrailingCommas(stripComments(text)));
}

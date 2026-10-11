type JsonDocumentRole = "request" | "proposal";
const MAX_DOCUMENT_UTF8_BYTES = 65_536;
const MAX_CONTAINER_DEPTH = 64;
const MAX_JSON_NODES = 4_096;

type JsonDocumentErrorReason =
  | "EXPECTED_STRING"
  | "MAX_BYTES_EXCEEDED"
  | "MAX_DEPTH_EXCEEDED"
  | "MAX_NODES_EXCEEDED"
  | "EMPTY_DOCUMENT"
  | "BOM_NOT_ALLOWED"
  | "DUPLICATE_KEY"
  | "NON_FINITE_NUMBER"
  | "INVALID_UNICODE"
  | "SYNTAX";

type ArrayFrame = {
  readonly kind: "ARRAY";
  state: "FIRST_VALUE_OR_END" | "VALUE" | "COMMA_OR_END";
};

type ObjectFrame = {
  readonly kind: "OBJECT";
  readonly keys: Set<string>;
  state:
    | "FIRST_KEY_OR_END"
    | "KEY"
    | "COLON"
    | "VALUE"
    | "COMMA_OR_END";
};

type JsonFrame = ArrayFrame | ObjectFrame;

function invalidJsonDocument(
  role: JsonDocumentRole,
  reason: JsonDocumentErrorReason,
): never {
  throw new Error(`INVALID_JSON_DOCUMENT:${role}:${reason}`);
}

function isJsonWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isNonZeroDigit(code: number): boolean {
  return code >= 0x31 && code <= 0x39;
}

function isHexDigit(code: number): boolean {
  return (
    isDigit(code) ||
    (code >= 0x41 && code <= 0x46) ||
    (code >= 0x61 && code <= 0x66)
  );
}

function skipWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length && isJsonWhitespace(text.charCodeAt(index))) {
    index += 1;
  }
  return index;
}

function validateUnicodeScalarString(
  value: string,
  role: JsonDocumentRole,
): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        invalidJsonDocument(role, "INVALID_UNICODE");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      invalidJsonDocument(role, "INVALID_UNICODE");
    }
  }
}

function utf8ByteLengthWithinLimit(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > MAX_DOCUMENT_UTF8_BYTES) {
      return bytes;
    }
  }
  return bytes;
}

function scanJsonString(
  text: string,
  start: number,
  role: JsonDocumentRole,
): Readonly<{ next: number; value: string }> {
  if (text.charCodeAt(start) !== 0x22) {
    invalidJsonDocument(role, "SYNTAX");
  }

  let decoded = "";
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 0x22) {
      validateUnicodeScalarString(decoded, role);
      return { next: index + 1, value: decoded };
    }
    if (code <= 0x1f) {
      invalidJsonDocument(role, "SYNTAX");
    }
    if (code !== 0x5c) {
      decoded += text.charAt(index);
      index += 1;
      continue;
    }

    index += 1;
    if (index >= text.length) {
      invalidJsonDocument(role, "SYNTAX");
    }
    const escape = text.charCodeAt(index);
    switch (escape) {
      case 0x22:
        decoded += '"';
        index += 1;
        break;
      case 0x2f:
        decoded += "/";
        index += 1;
        break;
      case 0x5c:
        decoded += "\\";
        index += 1;
        break;
      case 0x62:
        decoded += "\b";
        index += 1;
        break;
      case 0x66:
        decoded += "\f";
        index += 1;
        break;
      case 0x6e:
        decoded += "\n";
        index += 1;
        break;
      case 0x72:
        decoded += "\r";
        index += 1;
        break;
      case 0x74:
        decoded += "\t";
        index += 1;
        break;
      case 0x75: {
        const firstHexIndex = index + 1;
        const afterHexIndex = firstHexIndex + 4;
        if (afterHexIndex > text.length) {
          invalidJsonDocument(role, "SYNTAX");
        }
        for (
          let hexIndex = firstHexIndex;
          hexIndex < afterHexIndex;
          hexIndex += 1
        ) {
          if (!isHexDigit(text.charCodeAt(hexIndex))) {
            invalidJsonDocument(role, "SYNTAX");
          }
        }
        decoded += String.fromCharCode(
          Number.parseInt(text.slice(firstHexIndex, afterHexIndex), 16),
        );
        index = afterHexIndex;
        break;
      }
      default:
        invalidJsonDocument(role, "SYNTAX");
    }
  }

  invalidJsonDocument(role, "SYNTAX");
}

function scanJsonNumber(
  text: string,
  start: number,
  role: JsonDocumentRole,
): number {
  let index = start;
  if (text.charCodeAt(index) === 0x2d) {
    index += 1;
  }

  if (text.charCodeAt(index) === 0x30) {
    index += 1;
  } else if (isNonZeroDigit(text.charCodeAt(index))) {
    index += 1;
    while (isDigit(text.charCodeAt(index))) {
      index += 1;
    }
  } else {
    invalidJsonDocument(role, "SYNTAX");
  }

  if (text.charCodeAt(index) === 0x2e) {
    index += 1;
    if (!isDigit(text.charCodeAt(index))) {
      invalidJsonDocument(role, "SYNTAX");
    }
    while (isDigit(text.charCodeAt(index))) {
      index += 1;
    }
  }

  const exponent = text.charCodeAt(index);
  if (exponent === 0x65 || exponent === 0x45) {
    index += 1;
    const sign = text.charCodeAt(index);
    if (sign === 0x2b || sign === 0x2d) {
      index += 1;
    }
    if (!isDigit(text.charCodeAt(index))) {
      invalidJsonDocument(role, "SYNTAX");
    }
    while (isDigit(text.charCodeAt(index))) {
      index += 1;
    }
  }

  if (!Number.isFinite(Number(text.slice(start, index)))) {
    invalidJsonDocument(role, "NON_FINITE_NUMBER");
  }

  return index;
}

function preflightStrictJsonDocument(
  text: string,
  role: JsonDocumentRole,
): void {
  const stack: JsonFrame[] = [];
  let index = skipWhitespace(text, 0);
  let rootConsumed = false;
  let nodeCount = 0;

  if (index >= text.length) {
    invalidJsonDocument(role, "EMPTY_DOCUMENT");
  }
  if (text.charCodeAt(index) === 0xfeff) {
    invalidJsonDocument(role, "BOM_NOT_ALLOWED");
  }

  const consumeValue = (): void => {
    nodeCount += 1;
    if (nodeCount > MAX_JSON_NODES) {
      invalidJsonDocument(role, "MAX_NODES_EXCEEDED");
    }
    const code = text.charCodeAt(index);
    if (code === 0x7b) {
      if (stack.length + 1 > MAX_CONTAINER_DEPTH) {
        invalidJsonDocument(role, "MAX_DEPTH_EXCEEDED");
      }
      stack.push({
        kind: "OBJECT",
        keys: new Set<string>(),
        state: "FIRST_KEY_OR_END",
      });
      index += 1;
      return;
    }
    if (code === 0x5b) {
      if (stack.length + 1 > MAX_CONTAINER_DEPTH) {
        invalidJsonDocument(role, "MAX_DEPTH_EXCEEDED");
      }
      stack.push({ kind: "ARRAY", state: "FIRST_VALUE_OR_END" });
      index += 1;
      return;
    }
    if (code === 0x22) {
      index = scanJsonString(text, index, role).next;
      return;
    }
    if (code === 0x2d || isDigit(code)) {
      index = scanJsonNumber(text, index, role);
      return;
    }
    for (const literal of ["true", "false", "null"] as const) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    invalidJsonDocument(role, "SYNTAX");
  };

  while (true) {
    index = skipWhitespace(text, index);
    const frame = stack[stack.length - 1];
    if (frame === undefined) {
      if (!rootConsumed) {
        if (index >= text.length) {
          invalidJsonDocument(role, "SYNTAX");
        }
        rootConsumed = true;
        consumeValue();
        continue;
      }
      if (index !== text.length) {
        invalidJsonDocument(role, "SYNTAX");
      }
      return;
    }

    if (frame.kind === "ARRAY") {
      if (frame.state === "FIRST_VALUE_OR_END") {
        if (text.charCodeAt(index) === 0x5d) {
          stack.pop();
          index += 1;
        } else {
          frame.state = "COMMA_OR_END";
          consumeValue();
        }
      } else if (frame.state === "VALUE") {
        if (text.charCodeAt(index) === 0x5d) {
          invalidJsonDocument(role, "SYNTAX");
        }
        frame.state = "COMMA_OR_END";
        consumeValue();
      } else if (text.charCodeAt(index) === 0x2c) {
        frame.state = "VALUE";
        index += 1;
      } else if (text.charCodeAt(index) === 0x5d) {
        stack.pop();
        index += 1;
      } else {
        invalidJsonDocument(role, "SYNTAX");
      }
      continue;
    }

    if (frame.state === "FIRST_KEY_OR_END" || frame.state === "KEY") {
      if (
        frame.state === "FIRST_KEY_OR_END" &&
        text.charCodeAt(index) === 0x7d
      ) {
        stack.pop();
        index += 1;
        continue;
      }
      const key = scanJsonString(text, index, role);
      if (frame.keys.has(key.value)) {
        invalidJsonDocument(role, "DUPLICATE_KEY");
      }
      frame.keys.add(key.value);
      frame.state = "COLON";
      index = key.next;
    } else if (frame.state === "COLON") {
      if (text.charCodeAt(index) !== 0x3a) {
        invalidJsonDocument(role, "SYNTAX");
      }
      frame.state = "VALUE";
      index += 1;
    } else if (frame.state === "VALUE") {
      frame.state = "COMMA_OR_END";
      consumeValue();
    } else if (text.charCodeAt(index) === 0x2c) {
      frame.state = "KEY";
      index += 1;
    } else if (text.charCodeAt(index) === 0x7d) {
      stack.pop();
      index += 1;
    } else {
      invalidJsonDocument(role, "SYNTAX");
    }
  }
}

function normalizeParsedRecordPrototypes(root: unknown): void {
  const pending: unknown[] = [root];

  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object") {
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        pending.push(value[index]);
      }
      continue;
    }

    Object.setPrototypeOf(value, null);
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      pending.push(record[key]);
    }
  }
}

function parseStrictJsonDocument(
  input: unknown,
  role: JsonDocumentRole,
): unknown {
  if (typeof input !== "string") {
    invalidJsonDocument(role, "EXPECTED_STRING");
  }
  if (
    input.length > MAX_DOCUMENT_UTF8_BYTES ||
    utf8ByteLengthWithinLimit(input) > MAX_DOCUMENT_UTF8_BYTES
  ) {
    invalidJsonDocument(role, "MAX_BYTES_EXCEEDED");
  }

  preflightStrictJsonDocument(input, role);
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    invalidJsonDocument(role, "SYNTAX");
  }
  normalizeParsedRecordPrototypes(parsed);
  return parsed;
}

export function parseStrictJsonRequestDocument(input: unknown): unknown {
  return parseStrictJsonDocument(input, "request");
}

export function parseStrictJsonProposalDocument(input: unknown): unknown {
  return parseStrictJsonDocument(input, "proposal");
}

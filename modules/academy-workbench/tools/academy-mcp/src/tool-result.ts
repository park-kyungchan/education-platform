/** Existing MCP dual representation, measured as the actual serialized CallToolResult. */
export function toolResult(value: unknown) {
  const text = JSON.stringify(value);
  return { content: [{ type: 'text' as const, text }], structuredContent: JSON.parse(text) as Record<string, unknown> };
}
export const toolResultBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(toolResult(value)));
/** A record appears once as an object and once inside JSON-escaped content.text. */
export function recordTransportBytes(value: unknown) {
  const json = JSON.stringify(value);
  return Buffer.byteLength(json) + Buffer.byteLength(JSON.stringify(json)) - 2;
}

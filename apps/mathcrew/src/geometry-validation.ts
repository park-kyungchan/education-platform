import { strict as assert } from 'node:assert';
type Point = [number, number];
const near = (a: number, b: number, label: string) => assert(Math.abs(a - b) < 1e-8, label);
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

// Validate the actual emitted construction. Narrow grammar intentionally fails closed.
export function validateRenderedGeometry(html: string): void {
  const svg = /<svg class="construction"[^>]*>([\s\S]*?)<\/svg>/.exec(html)?.[1];
  assert(svg, 'construction SVG present');
  function tag(kind: string, name: string): string {
    const matches = [...svg!.matchAll(new RegExp(`<${kind} class="${name}"[^>]*>`, 'g'))];
    assert.equal(matches.length, 1, `${name}: exactly one emitted element`);
    return matches[0]![0];
  }
  function attr(element: string, name: string): string {
    const value = new RegExp(`\\b${name}="([^"]+)"`).exec(element)?.[1];
    assert(value !== undefined, `${name}: emitted attribute`);
    return value;
  }
  function number(element: string, name: string): number {
    const value = Number(attr(element, name));
    assert(Number.isFinite(value), `${name}: finite coordinate`);
    return value;
  }
  function circle(name: string): { center: Point; radius: number } {
    const element = tag('circle', name);
    return { center: [number(element, 'cx'), number(element, 'cy')], radius: number(element, 'r') };
  }
  function path(name: string, grammar: RegExp, count: number): number[] {
    const d = attr(tag('path', name), 'd');
    assert(grammar.test(d), `${name}: supported path grammar`);
    const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
    assert.equal(values.length, count, `${name}: coordinate count`);
    return values;
  }
  const { center: o, radius: r } = circle('unit-circle');
  assert(r > 0, 'positive unit-circle scale');
  const p = circle('point').center;
  assert.deepEqual(circle('origin').center, o, 'origin at circle center');
  const radius = sub(p, o);
  near(dot(radius, radius), r * r, 'point on unit circle');
  const rad = path('radius', /^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?$/, 4);
  assert.deepEqual(rad, [...o, ...p], 'emitted radius endpoints');
  const t = path('tangent', /^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?$/, 4);
  const a: Point = [t[0]!, t[1]!], b: Point = [t[2]!, t[3]!];
  const direction = sub(b, a);
  assert(dot(direction, direction) > 0, 'nondegenerate tangent');
  near(cross(sub(p, a), direction), 0, 'tangent incidence at P');
  near(dot(radius, direction), 0, 'tangent perpendicular to radius');
  const proj = path('projection', /^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?V-?\d+(?:\.\d+)?$/, 3);
  assert.deepEqual(proj, [...p, o[1]], 'projection from P onto x-axis');
  const angle = path('right-angle', /^m-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?-\d+(?:\.\d+)?$/, 6);
  const q: Point = [angle[0]!, angle[1]!];
  const u: Point = [angle[2]!, angle[3]!], v: Point = [angle[4]!, angle[5]!];
  near(cross(sub(q, p), radius), 0, 'right-angle marker starts on radius');
  near(cross(u, direction), 0, 'marker tangent edge');
  near(cross(v, radius), 0, 'marker radial edge');
  near(dot(u, v), 0, 'marker right angle');
  near(cross(sub([q[0] + u[0] + v[0], q[1] + u[1] + v[1]], p), direction), 0, 'marker ends on tangent');
  const math = (s: Point): Point => [(s[0] - o[0]) / r, (o[1] - s[1]) / r];
  near(math(p)[0], 3 / 5, 'P x label'); near(math(p)[1], 4 / 5, 'P y label');
  for (const s of [p, a, b]) near(3 * math(s)[0] + 4 * math(s)[1], 5, 'screen-to-math tangent equation');
  for (const label of ['P (3/5, 4/5)', 'x² + y² = 1', '3x + 4y = 5']) assert(svg.includes(`>${label}</text>`), `actual label: ${label}`);
}

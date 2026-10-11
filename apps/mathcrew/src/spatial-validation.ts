import { strict as assert } from 'node:assert';
// Consume actual emitted SVG; no renderer or model imports.
export function validateSpatial(html: string): void {
  const svg = /<svg class="spatial-construction"[^>]*>[\s\S]*?<\/svg>/.exec(html)?.[0];
  assert(svg, 'spatial construction emitted');
  const attr = (tag: string, key: string) => { const value = new RegExp(`\\b${key}="([^"]+)"`).exec(tag)?.[1]; assert(value !== undefined, `attribute ${key}`); return value; };
  const nums = (value: string) => value.split(',').map(Number);
  const m = nums(attr(svg, 'data-projection'));
  assert.equal(m.length, 7); assert(m.every(Number.isFinite));
  const project = (v: number[]) => [m[0]! + m[2]! * v[0]! + m[3]! * v[1]!, m[1]! + m[4]! * v[0]! + m[5]! * v[1]! + m[6]! * v[2]!];
  const vector = (value: string) => { const v = nums(value); assert.equal(v.length, 3); assert(v.every(Number.isFinite)); return v; };
  const tags = [...svg.matchAll(/<circle class="section-vertex"[^>]*>/g)].map(v => v[0]);
  assert.equal(tags.length, 6, 'six section vertices');
  const polygon = /<polygon class="cube-section"[^>]*>/.exec(svg)?.[0]; assert(polygon);
  const plane = nums(attr(polygon, 'data-plane'));
  assert.deepEqual(plane, [1, 1, 1, 1.5], 'plane agrees with displayed equation');
  const points = attr(polygon, 'points').split(' ').map(nums);
  assert.equal(points.length, 6);
  const seen = new Set<string>();
  tags.forEach((tag, i) => {
    const v = vector(attr(tag, 'data-space'));
    assert.deepEqual([...v].sort((a, b) => a - b), [0, .5, 1], 'vertex on a cube edge');
    assert.equal(v.reduce((sum, n, axis) => sum + n * plane[axis]!, 0), plane[3], 'vertex on the cutting plane');
    seen.add(v.join(','));
    const screen = [Number(attr(tag, 'cx')), Number(attr(tag, 'cy'))];
    assert.deepEqual(screen, project(v), 'actual vertex projection');
    assert.deepEqual(points[i], screen, 'polygon follows actual vertices');
    assert(screen[0]! > 0 && screen[0]! < 660 && screen[1]! > 0 && screen[1]! < 580, 'vertex visible in viewport');
  });
  assert.equal(seen.size, 6, 'unique section vertices');
  const edges = [...svg.matchAll(/<line class="cube-edge(?: hidden-edge)?"[^>]*>/g)].map(v => v[0]);
  assert.equal(edges.length, 12, 'twelve cube edges');
  const edgeSet = new Set<string>();
  for (const tag of edges) {
    const [a, b] = attr(tag, 'data-space').split(';').map(vector);
    assert(a && b); assert([...a, ...b].every(n => n === 0 || n === 1), 'unit cube corners');
    assert.equal(a.filter((n, axis) => n !== b[axis]).length, 1, 'unit edge');
    edgeSet.add([a.join(','), b.join(',')].sort().join(';'));
    assert.deepEqual([Number(attr(tag, 'x1')), Number(attr(tag, 'y1'))], project(a), 'edge start projection');
    assert.deepEqual([Number(attr(tag, 'x2')), Number(attr(tag, 'y2'))], project(b), 'edge end projection');
  }
  assert.equal(edgeSet.size, 12, 'unique cube edges');
  assert(svg.includes('>x + y + z = 3/2</text>'), 'displayed plane equation');
  let orientation = 0;
  for (let i = 0; i < 6; i++) {
    const a = points[i]!, b = points[(i + 1) % 6]!, c = points[(i + 2) % 6]!;
    const cross = (b[0]! - a[0]!) * (c[1]! - b[1]!) - (b[1]! - a[1]!) * (c[0]! - b[0]!);
    assert(cross !== 0, 'non-collinear section');
    if (orientation) assert(Math.sign(cross) === orientation, 'convex cyclic section');
    orientation = Math.sign(cross);
  }
}

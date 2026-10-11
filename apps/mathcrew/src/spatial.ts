import type { Copy } from './content';
type Vector = readonly [number, number, number];
const project = ([x, y, z]: Vector): [number, number] => [330 + 170 * x - 170 * y, 360 + 82 * x + 82 * y - 200 * z];
const section: readonly Vector[] = [[1, .5, 0], [.5, 1, 0], [0, 1, .5], [0, .5, 1], [.5, 0, 1], [1, 0, .5]];
const corners: readonly Vector[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const edges = corners.flatMap((a, i) => corners.slice(i + 1).filter(b => a.filter((value, axis) => value !== b[axis]).length === 1).map(b => [a, b] as const));
export function renderSpatial(c: Copy, e: (text: string) => string): string {
  const lines = edges.map(([a, b]) => {
    const [x1, y1] = project(a), [x2, y2] = project(b);
    const hidden = a.every(v => v === 0) || b.every(v => v === 0);
    return `<line class="cube-edge${hidden ? ' hidden-edge' : ''}" data-space="${a.join(',')};${b.join(',')}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  });
  const back = lines.filter(line => line.includes('hidden-edge')).join('');
  const front = lines.filter(line => !line.includes('hidden-edge')).join('');
  const points = section.map(v => project(v).join(',')).join(' ');
  return `<figure class="spatial-sheet"><svg class="spatial-construction" viewBox="0 0 660 580" role="img" aria-labelledby="spatial-title spatial-desc" data-projection="330,360,170,-170,82,82,-200"><title id="spatial-title">${e(c.spatialTitle)}</title><desc id="spatial-desc">${e(c.spatialDescription)}</desc><g class="cube-edges">${back}</g><polygon class="cube-section" data-plane="1,1,1,1.5" points="${points}"/><g class="cube-edges">${front}</g><path class="spatial-axis" d="M330 360V115M330 360 545 464M330 360 115 464"/><g class="section-vertices">${section.map(v => { const [x, y] = project(v); return `<circle class="section-vertex" data-space="${v.join(',')}" cx="${x}" cy="${y}" r="5"/>`; }).join('')}</g><g class="spatial-labels"><text x="341" y="112">z</text><text x="549" y="476">x</text><text x="102" y="476">y</text><text x="310" y="392">O</text><text x="330" y="555" text-anchor="middle">x + y + z = 3/2</text></g></svg><p class="spatial-question">${e(c.spatialQuestion)}</p><figcaption>${e(c.spatialCaption)}</figcaption><details class="construction-notes"><summary>${e(c.spatialSummary)}</summary><p>${e(c.spatialBody)}</p></details></figure>`;
}

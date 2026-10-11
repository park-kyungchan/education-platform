import { expect, test } from 'bun:test';
import { renderPage } from '../src/render';
import { validateRenderedGeometry } from '../src/geometry-validation';

test('labelled displaced-tangent mutant is rejected for incidence, not independent constants', () => {
  for (const language of ['en', 'ko'] as const) {
    const actual = renderPage('home', language);
    validateRenderedGeometry(actual);
    const mutant = actual.replace('class="tangent" d="M170 -10 570 290"', 'class="tangent" d="M170 10 570 310"');
    expect(mutant).not.toBe(actual);
    expect(() => validateRenderedGeometry(mutant)).toThrow('tangent incidence at P');
    console.log(`${language}: actual geometry PASS; displaced-tangent mutant REJECTED (tangent incidence at P)`);
  }
});

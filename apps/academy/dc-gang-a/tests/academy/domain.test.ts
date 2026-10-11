import { describe, expect, test } from 'bun:test';
import { validateHierarchy, sourceId, traceHierarchy, type CatalogNode } from '../../src/academy/domain';
import { known, unknown } from '../../src/learning/model';
import * as domain from '../../src/academy/domain';

describe('grounded shared curriculum hierarchy', () => {
  test('compact book names use explicit metadata without replacing edition identity or literal labels', () => {
    const node={id:'edition-a',kind:'book_edition' as const,sourceKey:{namespace:'academy_book',literalKey:'8101'},label:'Invented literal edition title',parent:unknown('root'),bookIdentity:{series:'gauss' as const,schoolStage:'elementary' as const,grade:5,term:2 as const,volume:2,evidenceRefs:['fixture-edition-mapping']}};
    expect(()=>validateHierarchy([node])).not.toThrow();
    expect(domain.catalogDisplayName(node)).toBe('가우스 5-2-2');
    expect(node.label).toBe('Invented literal edition title');
    expect(domain.catalogDisplayName({...node,bookIdentity:{...node.bookIdentity,schoolStage:'middle',grade:1}})).toBe('가우스 중1-2-2');
    expect(()=>validateHierarchy([{...node,bookIdentity:{...node.bookIdentity,grade:0}}])).toThrow('invalid_book_identity');
    expect(()=>validateHierarchy([{...node,kind:'major_unit'} as CatalogNode])).toThrow('book_identity_requires_edition');
  });
  test('binds a section to its actual unit scope while retaining legacy page parents', () => {
    const make = (id:string,kind:string,parent:string|null):CatalogNode => ({id,kind,sourceKey:{namespace:'fixture_catalog',literalKey:id},label:'Invented '+id,parent:parent?known(parent,['fixture']):unknown('root')} as CatalogNode);
    const base=[make('book','book_edition',null),make('major','major_unit','book'),make('middle','middle_unit','major'),make('minor','minor_unit','middle')];
    const section=make('section','learning_section','minor'),assessment=make('assessment','learning_section','major');
    const nodes=[...base,section,assessment,make('page','printed_page','section'),make('legacy-page','printed_page','minor')];
    expect(()=>validateHierarchy(nodes)).not.toThrow();
    expect(traceHierarchy(nodes,'page').path.map(node=>node.id)).toEqual(['book','major','middle','minor','section','page']);
    expect(traceHierarchy(nodes,'assessment').path.map(node=>node.id)).toEqual(['book','major','assessment']);
    expect(()=>validateHierarchy([...base,{...section,parent:known('book',['fixture'])}])).toThrow('catalog_parent_level');
  });
  test('preserves namespaced source labels and requires each known parent level', () => {
    const book: CatalogNode = { id: 'catalog-book', kind: 'book_edition', sourceKey: { namespace: 'academy_book', literalKey: '8101' }, label: 'Invented edition', parent: unknown('root_book') };
    const major: CatalogNode = { id: 'catalog-major', kind: 'major_unit', sourceKey: { namespace: 'academy_major_unit', literalKey: 'unit-1' }, label: 'Invented major', parent: known(book.id, ['fixture']) };
    const nodes = [book, major];
    validateHierarchy(nodes);
    expect(traceHierarchy(nodes, major.id).path.map(row => row.id)).toEqual([book.id, major.id]);
    expect(sourceId({ namespace: 'academy_video_label', literalKey: 'H2031' })).not.toBe(sourceId({ namespace: 'academy_board_lecture', literalKey: 'H2031' }));
    expect(() => validateHierarchy([book, { ...major, kind: 'minor_unit' }])).toThrow('catalog_parent_level');
  });
});

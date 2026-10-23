/** Existing catalog kind and level order; shared contract only. */
export type CatalogKind = 'book_edition' | 'major_unit' | 'middle_unit' | 'minor_unit' | 'learning_section' | 'printed_page' | 'problem';
export const catalogLevels: readonly CatalogKind[] = ['book_edition', 'major_unit', 'middle_unit', 'minor_unit', 'learning_section', 'printed_page', 'problem'];

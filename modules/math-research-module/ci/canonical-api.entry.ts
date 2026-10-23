// Generation-only entry. Every exported implementation remains pinned canonical source.
// @ts-expect-error This virtual label resolves only from the closed immutable compiler input map.
export { validateArtifact, validateReferences } from 'canonical:ontology-validation';
// @ts-expect-error This virtual label resolves only from the closed immutable compiler input map.
export { validateCheckpoint, validateWorkContextRequest } from 'canonical:context-validation';
// @ts-expect-error This virtual label resolves only from the closed immutable compiler input map.
export { checkSources, localContextIo, readExact } from 'canonical:context-source';

# mathCrew public site

A reviewed static bilingual mathCrew frontend, built with TypeScript and Bun. English and Korean pages explain the mathematics inquiry direction, distinguish planned capabilities from current founder-only dc use, and provide contact, privacy and site-use information. The spatial SVG is a precise static concept illustration, not a delivered interactive digital twin.

## Development

This source was developed with AI assistance through Hermes and locally reviewed and tested. This package is the scoped public-site source, not a native Hermes profile export, the whole Hermes installation, a private product export, or an AI-provider SDK. It contains no Claude API integration, model evaluation results, student metrics or claims of external traction.

Use Bun 1.4.1 on PATH. No dependency installation is needed.
Tests use TMPDIR when set, otherwise the platform temporary directory returned by node:os. The portability regression allocates one unique temporary base, copies only explicitly listed public files into a synthetic checkout containing spaces and Korean characters, runs build/check/verify, and rejects percent-encoded sibling writes without recursively spawning itself. CI explicitly uses the runner's temporary directory.

    bun --no-env-file run build
    bun --no-env-file run test
    bun --no-env-file run check
    bun --no-env-file run verify

Build emits eight HTML pages plus CSS, favicon and local font/license into dist/. Commands run without loading .env files, starting a listener or calling a network provider. The preview-handler module is a directly tested Request/Response function, not a running server. Tests use synthetic mutations/requests and the bundled public source; no private predecessor checkout is required.

The verification command rebuilds twice and compares every output path, byte size and SHA-256. A checked-in expected-output fixture pins local V5 output, not byte-identical V4 output. Only the two home pages, CSS and four legal pages intentionally change; font, license, favicon, localized fallback output and spatial component source remain unchanged. Geometry tests mutate actual emitted SVG tangency, projected vertices and polygon coordinates. Further gates check nested localized fallbacks, GET/HEAD, denied source routes, privacy boundaries, local font/license integrity and Unicode cmap coverage for Korean public text. Bun bundling checks syntax/import closure; it is not full TypeScript type checking. These checks do not claim fresh browser visual acceptance or public deployment.

## Publication and boundaries

Only scoped source, synthetic tests, documentation, minimal CI and the licensed font belong to this candidate. Internal lineage, operational receipts, original narratives, historical records, credentials and private runtime data are excluded. dist/ is generated and ignored by Git; no existing private history is carried here. The only live product link remains the separate authenticated dc application.

The development section renders six independently reviewed, actually published source snapshots: default, dc-context, dc-contract-audit, dc-gang-a-dev, dc-review and ontology-platform. They were developed with AI assistance through Hermes, not exported as live profile apps or private histories. The product slice is a bounded two-source clinic workbench, not a full private codebase, history or production-runtime migration. GitHub is a separate public development host, not a product login or provider permission; no GitHub asset is loaded. Source publication and remote CI are separate observations; source links alone do not establish CI success. The package private field only prevents npm publication, not GitHub visibility. A one-time operator-selected projection supplies exact public identities; ordinary caller-owned data is captured before validation without invoking getters, custom iterators or array methods. These checks do not authenticate GitHub or create native permission and are not a Proxy or OS sandbox. This six-link landing still requires exact independent source review, Lead browser acceptance and separate production deployment. Publishing the repositories does not deploy this site to its apex domain.

## Rights and third-party assets

Original code rights remain reserved by its owner. Public visibility alone grants no permissive license; package metadata is UNLICENSED. The bundled unmodified Nanum Gothic font is separately licensed under SIL Open Font License 1.1. Its exact copyright/license notice is at src/assets/fonts/nanum-gothic-license.txt, and upstream commit, URL and SHA-256 provenance are at src/assets/fonts/font-source.json. Builds retain that notice beside the font. This rights statement does not override the font license.

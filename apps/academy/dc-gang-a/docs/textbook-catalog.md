# Printed textbook catalog

Use [the qualified edition catalog](../research/textbooks/edition-catalog-20261028-v2.json) before interviewing a teacher about a book's TOC or section names. It contains eight observed editions, their complete printed TOC structure, and short descriptions of every named component in the pages immediately before each TOC. The earlier v1 is retained as superseded evidence.

Select the exact registered school level, grade, term, brand, series and version. Cover codes are a separate namespace from native course/book IDs. Middle-school Davinci has no inferred series; its printed middle units remain middle units. Unnumbered elementary Davinci topic groups carry an explicitly derived coordinate, not a claimed printed ordinal.

Book-level guide components do not prove their presence in every unit. Keep `실력 쌓기`, `실력 다지기` and `실력 올리기` distinct. Within-guide combined headings retain separate components when identified separately. Printed page numbers and PDF file page positions are separate; an unobserved section boundary stays unknown. Missing score rows are neither absent printed sections nor incomplete homework.

Current private registration bindings and dated teacher corrections are reached through `/home/palantirkc/operations/academy-main-practical-20261028/read-entry-v2.json`. That entry selects the exact student's eight-book binding subset, private source-readback receipts and the next Friday checklist. The inspected PDFs and rendered evidence pages are retained there outside Git. Do not load unrelated students or infer a live registration refresh from this dated view.

For a repeated lookup, read the requested student's binding once, select its `editionRef` in the shared catalog, then inspect only the relevant TOC node and guide component. A new source call or teacher question is needed only for a genuinely unresolved or changed binding, assignment, page boundary or completion state. Current teacher decisions take precedence over earlier tentative book/unit interpretations.

Keep retrieval bounded: parse the JSON locally and return only the requested edition/unit instead of loading the full catalog or rendering the PDF again. For example, from this package root:

```sh
bun -e 'const c=await Bun.file("research/textbooks/edition-catalog-20261028-v2.json").json(); const b=c.books.find(b=>b.editionRef===Bun.argv[1]); if(!b)throw Error("edition_not_cataloged"); console.log(JSON.stringify({editionRef:b.editionRef,identity:b.identity,nodes:b.toc.nodes.filter(n=>n.code===Bun.argv[2]),components:b.sectionGuide.components}));' 1SAG:v1 5-1
```

Reuse the catalog while its exact edition and evidence remain applicable. Reinspect images only for a new or changed edition, a source discrepancy, or an assignment boundary that the catalog does not establish.

These files are source-owned reference data. They do not install native MCP mappings, alter owner credentials, generate assignments or transmit parent messages. Original admitted private packages remain byte-preserved.

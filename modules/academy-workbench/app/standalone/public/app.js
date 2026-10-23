"use strict";
(() => {
  // src/client/renderers/rails.ts
  var esc = (value) => String(value ?? "\uBBF8\uC81C\uACF5").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var raw = (value) => esc(JSON.stringify(value, null, 2));
  var safe = (u) => {
    try {
      const parsed = new URL(u);
      return typeof u === "string" && ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? u : null;
    } catch {
      return null;
    }
  };
  var states = { observed: "\uCC44\uC810 \uAE30\uB85D", observed_absent: "\uC870\uD68C \uBC94\uC704 \uACB0\uACFC\uD589 \uC5C6\uC74C", mapping_unknown: "\uB300\uC751 \uBBF8\uD655\uC778", not_checked: "\uC218\uD589 \uBBF8\uC870\uD68C", app_not_recorded: "\uC571 \uBBF8\uAE30\uB85D", not_determined: "\uC644\uB8CC \uBBF8\uD655\uC778", not_supplied: "\uBBF8\uC81C\uACF5", not_observed_in_catalog: "\uBAA9\uB85D \uBBF8\uAD00\uCC30", unverified_for_this_unit: "\uB2E8\uC6D0\uBCC4 \uC874\uC7AC \uBBF8\uAC80\uC99D", observed_in_native_catalog: "\uBAA9\uB85D\uC5D0\uC11C \uC874\uC7AC \uAD00\uCC30", observed_in_sample_body: "\uC0D8\uD50C \uBCF8\uBB38\uC5D0\uC11C \uC874\uC7AC \uAD00\uCC30", provisional_catalog_join: "\uBAA9\uB85D \uCF54\uB4DC \uC7A0\uC815 \uC5F0\uACB0", printed_toc_verified_body_partial: "\uBAA9\uCC28 \uAC80\uC99D \xB7 \uBCF8\uBB38 \uC77C\uBD80", not_captured: "not_captured \xB7 \uC218\uC9D1 \uC790\uB8CC \uC5C6\uC74C" };
  var label = (s) => states[s] ?? String(s ?? "unknown");
  var levels = { major: "\uB300\uB2E8\uC6D0", middle: "\uC911\uB2E8\uC6D0", subunit: "\uC18C\uB2E8\uC6D0", major_assessment: "\uB300\uB2E8\uC6D0 \uD3C9\uAC00", answers: "\uC815\uB2F5" };
  var marker = (r) => {
    const s = r.performanceState ?? r.evidenceState;
    return s === "observed" ? ["\u2299", "observed"] : s === "mapping_unknown" ? ["\u25C7", "mapping"] : s === "observed_absent" ? ["\u2301", "absent"] : ["\xB7", "not-queried"];
  };
  var sourceName = (u) => new URL(u).hostname + (new URL(u).pathname.toLowerCase().endsWith(".pdf") ? " \xB7 PDF \uC790\uB8CC" : "");
  var sourceLinks = (urls) => [...new Set(urls)].filter(safe).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(sourceName(u))} \u2197</a></li>`).join("");
  var dl = (fields) => `<dl>${fields.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("")}</dl>`;
  function mountC2ProgressRails(view, target) {
    const V = view, records = V.records;
    const rows = V.books.flatMap((b) => b.rows);
    const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
    let selectedId = null;
    const stats = { records: Object.keys(records).length, codes: new Set(Object.values(records).map((r) => r.catalogCode).filter(Boolean)).size, attempts: Object.values(records).flatMap((r) => r.attemptEvidence).length };
    const countWithin = (row) => row.recordIds.length + rows.filter((r) => r.parentId === row.id).reduce((n, r) => n + countWithin(r), 0);
    const orderRecords = (row, book) => {
      const ord = new Map((book.raw.sectionFlow ?? []).map((s) => [s.cacheRef, s.order]));
      return row.recordIds.map((id, i) => ({ r: records[id], i, o: ord.get(records[id].publicSectionTemplateRef) ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.r);
    };
    function record(r, index) {
      const [glyph, kind] = marker(r), attempts = r.attemptEvidence.filter((a) => typeof a.score === "number");
      const score = attempts.map((a) => a.score).join(" / "), dates = attempts.map((a) => a.dateRaw ?? "\uB0A0\uC9DC \uBBF8\uC81C\uACF5").join(" / ");
      const lesson = r.lessonIndex !== null ? `${r.lessonIndex}\uCC28\uC2DC` : null;
      return `<details class="record" data-record-container="${esc(r.recordId)}"><summary class="record-summary" data-record-id="${esc(r.recordId)}" tabindex="0" aria-expanded="false" aria-controls="c2-detail-${index}" aria-label="${esc(r.sectionDisplayLabel + (lesson ? " " + lesson : "") + " \xB7 " + label(r.performanceState ?? r.evidenceState))}"><span class="glyph ${kind}" aria-hidden="true">${glyph}</span><span class="record-label">${esc(r.sectionDisplayLabel)}${lesson ? `<small>${esc(lesson)}</small>` : ""}</span><span class="code">${esc(r.catalogCode ?? "\uCF54\uB4DC \uBBF8\uAD00\uCC30")}</span><span class="evidence-status ${kind}">${esc(label(r.performanceState ?? r.evidenceState))}</span><span class="numeric ${score ? "" : "empty"}">${score ? `${esc(score)}<small>\uC810</small><span class="raw-date">${esc(dates)}</span>` : "\uCC44\uC810 \uADFC\uAC70 \uC5C6\uC74C"}</span><span class="teacher">\uAD50\uC0AC \uD310\uB2E8<br>${esc(label(r.teacherVerdict.state))}</span><span class="expand-sign" aria-hidden="true">+</span></summary><div class="inline-evidence" id="c2-detail-${index}" data-detail-record="${esc(r.recordId)}"></div></details>`;
    }
    let ordinal = 0;
    function recordsLane(row, book) {
      const rr = orderRecords(row, book);
      return rr.length ? `<div class="record-stack" aria-label="${esc(row.title)} \uC139\uC158 \uD45C\uC2DC \uC21C\uC11C">${rr.map((r) => record(r, ordinal++)).join("")}</div>` : `<p class="no-records">\uC774 \uBAA9\uCC28 \uB178\uB4DC\uC5D0 \uACF5\uAE09\uB41C \uC139\uC158 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA85\uC2DC\uC801 \uBBF8\uBC30\uC815 \uB610\uB294 \uBBF8\uC644\uB8CC\uB77C\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.</p>`;
    }
    function node(row, book, first2) {
      const children = book.rows.filter((r) => r.parentId === row.id);
      if (row.level === "major") return `<details class="major" data-toc-node="${esc(row.id)}" ${first2 ? "open" : ""}><summary class="major-summary"><span class="major-sign">${esc(row.label)}</span><span class="major-title">${esc(row.title)}</span><span class="major-count">${countWithin(row)}\uAC1C \uAE30\uB85D</span></summary>${row.recordIds.length ? recordsLane(row, book) : ""}${children.map((c) => node(c, book, false)).join("")}</details>`;
      if (row.level === "middle" && children.length) return `<section class="middle" data-toc-node="${esc(row.id)}"><div class="middle-heading"><h3>${esc(row.title)}</h3><span class="node-meta">${esc(levels[row.level])}<br>\uBD80\uBAA8 \uAD00\uACC4: ${esc(row.parentRelationState)}</span></div>${row.recordIds.length ? recordsLane(row, book) : ""}${children.map((c) => node(c, book, false)).join("")}</section>`;
      const isAssessment = row.level === "major_assessment";
      return `<section class="${row.level === "middle" ? "middle" : "unit"} ${isAssessment ? "assessment" : ""}" data-toc-node="${esc(row.id)}"><div class="unit-head"><span class="unit-number">${esc(isAssessment ? "ASSESS" : row.label)}</span><h4>${esc(row.title)}</h4><span class="node-meta">${esc(levels[row.level] ?? row.level)}${row.raw.printedStartPage !== null ? "<br>p." + esc(row.raw.printedStartPage) : ""}</span></div>${recordsLane(row, book)}${children.map((c) => node(c, book, false)).join("")}</section>`;
    }
    const books = V.books.map((b, i) => `<section class="book" id="c2-book-${i}" data-book-key="${esc(b.key)}"><div class="book-head"><span class="book-number">0${i + 1}</span><div><h2>${esc(b.label)}</h2><div class="identity">${esc(b.raw.originalBookTitle)}<br>\uCF54\uB4DC ${esc(b.raw.bookCode)} \xB7 \uD310\uBCF8 ${esc(b.edition)} \xB7 \uACF5\uAC1C \uB9AC\uBE44\uC804 ${esc(b.raw.sourceEditionBinding.publicRevisionLabel)}<br>\uD559\uC0DD \uC885\uC774 \uAD50\uC7AC \uB9AC\uBE44\uC804 \uBBF8\uD655\uC778</div></div><div class="coverage"><b>\uBAA9\uCC28</b> ${b.tocCoverage.state === "printed_toc_verified" || b.tocCoverage.state === "entire_printed_toc_verified" ? "\uC804\uCCB4 \uC778\uC1C4 \uBAA9\uCC28" : "\uD559\uC6D0 \uBAA9\uB85D \uAD6C\uC870 \xB7 \uC778\uC1C4 \uBAA9\uCC28 \uBBF8\uAC80\uC99D"} ${b.rows.length}\uB178\uB4DC<br><b>\uBCF8\uBB38</b> ${b.tocCoverage.state === "native_catalog_only" ? "\uBCF8\uBB38 \uBBF8\uAC80\uC99D" : "\uACF5\uAC1C \uC0D8\uD50C \uC77C\uBD80\uB9CC \uD655\uC778"}<br><b>\uC218\uD589</b> ${b.rows.reduce((n, r) => n + r.recordIds.length, 0)}\uAC1C \uAE30\uB85D\xB7\uD655\uC778\uCE78 / \uCC44\uC810 ${esc(b.performanceCoverage.attemptObservationCount)}\uAC74<br>\uC804\uCCB4 \uD559\uC0DD \uC774\uB825\uC740 \uBD88\uC644\uC804</div></div><details class="guide"><summary>\uAD50\uC7AC \uC548\uB0B4 \uC21C\uC11C\uC640 \uC801\uC6A9 \uBC94\uC704</summary><ol class="guide-flow">${(b.raw.sectionFlow ?? []).map((s) => `<li>${esc(s.sourceLabel)}</li>`).join("")}</ol><p>\uC774 \uC120\uACFC \uC21C\uC11C\uB294 \uAD50\uC7AC\uC758 \uC778\uC1C4\xB7\uD45C\uC2DC \uC21C\uC11C\uC785\uB2C8\uB2E4. \uC778\uC9C0 \uC758\uC874\uC131\xB7\uC120\uC218 \uAD00\uACC4\xB7\uC644\uB8CC \uC804\uC774\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC548\uB0B4\uC5D0 \uC788\uB294 \uBAA8\uB4E0 \uC139\uC158\uC774 \uAC01 \uB2E8\uC6D0\uC5D0 \uC874\uC7AC\uD558\uAC70\uB098 \uBC30\uC815\uB410\uB2E4\uB294 \uB73B\uB3C4 \uC544\uB2D9\uB2C8\uB2E4. \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC740 \uD655\uC778\uCE78\uC740 \uC6D0\uBCF8 \uD45C\uC2DC \uC21C\uC11C \uB05D\uC5D0 \uBCF4\uC874\uD569\uB2C8\uB2E4.</p></details>${b.rows.filter((r) => r.parentId === null).map((r, j) => node(r, b, i === 0 && j === 0)).join("")}</section>`).join("");
    target.classList.add("c2");
    target.innerHTML = `<a class="skip" href="#c2-books">\uAD50\uC7AC \uADFC\uAC70 \uB808\uC77C\uB85C \uC774\uB3D9</a><div class="frame"><div class="topline"><span class="wordmark">\uAD50\uC7AC\uC758 \uD750\uB984, \uADFC\uAC70\uC758 \uAE30\uB85D</span><span class="edition-mark">C2 / PRIVATE SNAPSHOT</span></div><header class="hero"><div><p class="overline">SECTION FLOW \xB7 READ FIRST</p><h1>${esc(V.studentLabel)}\uC758 \uAD50\uC7AC\uB97C \uC77D\uB2E4</h1><p class="hero-note">\uC587\uC740 \uD589\uC744 \uB530\uB77C \uD544\uC694\uD55C \uADFC\uAC70\uB9CC \uD3BC\uCCD0 \uBD05\uB2C8\uB2E4.<br>\uC139\uC158\uC758 \uC21C\uC11C\uC640 \uAD50\uC0AC\uC758 \uD310\uB2E8\uC744, \uAC01\uAC01 \uADF8\uB300\uB85C.</p></div><div><div class="count-line"><span><strong>${stats.records}</strong> <small>\uAE30\uB85D\xB7\uD655\uC778\uCE78</small></span><span><strong>${stats.codes}</strong> <small>\uBAA9\uB85D \uCF54\uB4DC</small></span><span><strong>${stats.attempts}</strong> <small>\uCC44\uC810 \uAD00\uCC30</small></span></div><div class="source-time">\uC800\uC7A5 \uC2A4\uB0C5\uC0F7 ${esc(V.sourceContractVersion)}<br>\uD559\uC0DD \uC218\uD589 \uAE30\uC900\uC2DC\uAC01: ${esc(V.sourceAsOf.studentPerformance ?? "\uBBF8\uC81C\uACF5")}<br>\uBAA9\uCC28 \uCE90\uC2DC \uD655\uC778: ${esc(V.sourceAsOf.editionCacheVerifiedAt)}<br>\uD604\uC7AC \uD559\uC6D0 \uAE30\uB85D\uC744 \uC0C8\uB85C \uC870\uD68C\uD55C \uD654\uBA74\uC774 \uC544\uB2D9\uB2C8\uB2E4.</div></div></header><div class="notice"><b>\uC804\uCCB4 \uC644\uB8CC \uBBF8\uD655\uC778</b><span>\uC810\uC218 100\uC740 \uC644\uB8CC \uD310\uB2E8\uACFC \uBCC4\uAC1C\uC785\uB2C8\uB2E4. \uBC30\uC815 \uBC94\uC704\xB7\uC644\uB8CC \uAE30\uC900\uC774 \uB2EB\uD788\uC9C0 \uC54A\uC544 \uC644\uB8CC\uC728\uACFC \uC608\uC0C1 \uAE30\uAC04\uC744 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</span></div><nav class="book-nav" aria-label="\uAD50\uC7AC \uC774\uB3D9">${V.books.map((b, i) => `<a href="#c2-book-${i}">${esc(b.label)} <span>${esc(b.key)}</span> \u2198</a>`).join("")}</nav><div class="legend"><div class="legend-list"><span><i class="glyph observed" aria-hidden="true">\u2299</i> \uCC44\uC810 \uAE30\uB85D</span><span><i class="glyph mapping" aria-hidden="true">\u25C7</i> \uB300\uC751 \uBBF8\uD655\uC778</span><span><i class="glyph" aria-hidden="true">\u2301</i> \uC870\uD68C \uBC94\uC704 \uACB0\uACFC\uD589 \uC5C6\uC74C</span><span><i class="glyph" aria-hidden="true">\xB7</i> \uC218\uD589 \uBBF8\uC870\uD68C</span></div><button type="button" data-expand-majors>\uBAA8\uB4E0 \uB300\uB2E8\uC6D0 \uD3BC\uCE58\uAE30</button></div><div id="c2-status" class="sr-only" role="status" aria-live="polite"></div><div id="c2-books" tabindex="-1">${books}</div><footer class="footer"><div><h2>\uBB34\uC5C7\uC774 \uD655\uC778\uB410\uACE0, \uBB34\uC5C7\uC774 \uB0A8\uC558\uB294\uAC00</h2><p>\uBAA9\uCC28\xB7\uC139\uC158 \uC874\uC7AC\xB7\uC870\uD68C \uBC94\uC704\xB7\uCC44\uC810\xB7\uC815\uD655\uD55C \uB300\uC751\xB7\uAD50\uC0AC \uC644\uB8CC \uD310\uB2E8\uC740 \uB3C5\uB9BD\uB41C \uCD95\uC785\uB2C8\uB2E4. \uACB0\uACFC\uD589\uC774 \uC5C6\uB2E4\uB294 \uAD00\uCC30\uC744 \uC2E4\uC81C \uBBF8\uC218\uD589\uC73C\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p>\uAE30\uBCF8\uC608\uC81C\uB294 \uC571\uC5D0 \uAE30\uB85D\uD558\uC9C0 \uC54A\uB294\uB2E4\uB294 \uC0AC\uC6A9\uC790 \uC124\uBA85\uC744 \uC815\uD655\uD55C \uC6D0\uBB38 \uB77C\uBCA8 \uBC94\uC704\uC5D0\uB9CC \uBCF4\uC874\uD569\uB2C8\uB2E4. \uAC1C\uB150\uC608\uC81C\xB7\uAE30\uBCF8\uBB38\uC81C\uC640 \uD569\uCE58\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. ${V.terminologyPolicy ? "DT\uB294 DailyTest \uC218\uC5C5 \uD65C\uB3D9\uC774\uBA70 Daily Restudy \uAD50\uC7AC \uC139\uC158\uACFC \uC11C\uB85C \uB2E4\uB978 \uD56D\uBAA9\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uC815\uC815 \uADDC\uCE59\uC774\uBA70 \uD559\uC6D0 UI \uD0C0\uC785 \uB300\uC751\uC740 \uBBF8\uAC80\uC99D\uC785\uB2C8\uB2E4." : "DT\uC640 Daily Restudy\uC758 \uB3D9\uC77C\uC131\uC740 \uBBF8\uAC80\uC99D\uC785\uB2C8\uB2E4."}</p><p>\uBB38\uD56D\uBCC4 \uCC44\uC810\xB7\uB2F5\uC548 \uC774\uBBF8\uC9C0\xB7\uD544\uAE30 \uB178\uD2B8\xB7\uD480\uC774 \uB178\uD2B8\uB294 not_captured\uC785\uB2C8\uB2E4. \uC218\uC9D1 \uC790\uB8CC\uAC00 \uC5C6\uB2E4\uB294 \uAC83\uC740 \uD559\uC0DD\uC5D0\uAC8C \uB178\uD2B8\uB098 \uD480\uC774\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uBB38\uD56D \uC804\uCCB4 \uBD84\uBAA8\uB294 null\uC785\uB2C8\uB2E4.</p></div><div><h2>\uCD9C\uCC98\uC640 \uB300\uC751\uC744 \uBCF4\uC874\uD569\uB2C8\uB2E4</h2><p>\uAC80\uC99D\uB41C \uC778\uC1C4 \uBAA9\uCC28\uC640 \uD559\uC6D0 \uBAA9\uB85D\uC758 \uBC88\uD638 \uADF8\uB8F9\uC744 \uAD6C\uBD84\uD569\uB2C8\uB2E4. \uBC88\uD638 \uADF8\uB8F9\uC758 \uC2E4\uC81C \uBAA9\uCC28 \uB2E8\uACC4\uB294 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4. \uACF5\uAC1C \uC0D8\uD50C\uC740 \uC804\uCCB4 \uAD50\uC7AC \uBCF8\uBB38\uC774\uB098 \uC885\uC774 \uD310\uBCF8\uC758 \uAC80\uC99D\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><details><summary>\uBBF8\uC5F0\uACB0 \uC77C\uC9C0\xB7\uC219\uC81C \uC6D0\uBB38\xB7\uC785\uB825 SHA</summary><div class="source-note">${V.unmappedAssertions.map((a) => `<p>${esc(a.dateRaw)} \xB7 ${esc(a.statement)}<br>${esc(a.reason)}<br>${safe(a.sourceUrl) ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">\uC800\uC7A5 \uC77C\uC9C0 \uADFC\uAC70 \u2197</a>` : ""}</p>`).join("")}<p>\uC219\uC81C \uC6D0\uBB38: ${esc(V.raw.currentHomeworkSource)}</p><p>\uC219\uC81C \uD398\uC774\uC9C0 \uB300\uC751\uC740 \uBAA9\uCC28 \uAD6C\uAC04 \uAE30\uBC18 \uC7A0\uC815 \uC5F0\uACB0\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uBB38\uD56D\xB7\uC885\uC774 \uC644\uB8CC\uB294 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4.</p><p class="raw-id">SHA-256(\uC6D0\uBCF8 \uD30C\uC77C \uBC14\uC774\uD2B8): ${esc(V.inputSha256)}</p></div></details><p>\uC678\uBD80 \uD3F0\uD2B8\xB7CDN\uC744 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uADFC\uAC70\uB294 \uC774 \uB3C5\uB9BD \uC11C\uBC84\uC758 \uC18C\uC720\uC790 \uBC94\uC704 \uC870\uD68C \uACBD\uB85C\uC5D0\uC11C \uBD88\uB7EC\uC635\uB2C8\uB2E4.</p></div></footer></div>`;
    const summaries = () => [...target.querySelectorAll("[data-record-id]")];
    function notebookRows(r) {
      return [["lecture_notes", "\uD544\uAE30 \uB178\uD2B8"], ["solution_notes", "\uD480\uC774 \uB178\uD2B8"]].map(([kind, title]) => {
        const notes = V.notebookEvidence.filter((n) => n.kind === kind && n.targets.some((t) => t.tocNodeRef === r.tocNodeRef && (t.sectionRecordId === null || t.sectionRecordId === r.recordId)));
        return notes.length ? notes.map((n) => `<div class="capture-line">${esc(title)} \xB7 ${esc(n.captureState)}<details><summary>\uB178\uD2B8 \uB300\uC0C1\xB7\uADFC\uAC70\xB7\uAD50\uC0AC \uAC80\uD1A0</summary><pre>${raw(n)}</pre></details></div>`).join("") : `<div class="capture-line">${esc(title)}<br>not_captured \xB7 \uC218\uC9D1 \uC790\uB8CC \uC5C6\uC74C<br>\uAD50\uC0AC \uAC80\uD1A0: \uBBF8\uC81C\uACF5</div>`;
      }).join("");
    }
    ;
    function detail(r) {
      const row = rowById[r.tocNodeRef], attempts = r.attemptEvidence;
      return `<div class="detail-line"><h5>${esc(r.unitLabel)} \xB7 ${esc(r.unitTitle)} / ${esc(r.sectionDisplayLabel)}${r.lessonIndex !== null ? " \xB7 " + esc(r.lessonIndex) + "\uCC28\uC2DC" : ""}</h5><button type="button" class="close-inline" data-close-record>\uADFC\uAC70 \uC811\uAE30 \u2191</button></div><div class="detail-columns"><section><h6>\uC815\uD655\uD55C \uB300\uC0C1\uACFC \uB3C5\uB9BD\uB41C \uC0C1\uD0DC</h6>${dl([["\uC778\uC1C4/\uACF5\uAC1C \uB77C\uBCA8", r.publicSectionLabel ?? "\uBBF8\uC81C\uACF5"], ["\uC571 \uC6D0\uBB38 \uB77C\uBCA8", r.sectionSourceLabel], ["\uBAA9\uB85D \uCF54\uB4DC", r.catalogCode ?? "\uBBF8\uAD00\uCC30"], ["\uC139\uC158 \uC874\uC7AC", label(r.sectionApplicabilityState)], ["\uBAA9\uB85D \uC874\uC7AC", label(r.catalogPresence)], ["\uC870\uD68C/\uC218\uD589", label(r.performanceState ?? r.evidenceState)], ["\uC815\uD655\uD55C \uB9E4\uD551", label(r.mappingState)], ["\uAD50\uC0AC \uD310\uC815", label(r.teacherVerdict.state) + " \xB7 " + String(r.teacherVerdict.value ?? "unknown")], ["\uC885\uC774 \uD655\uC778", label(r.paperEvidence.state)], ["\uC644\uB8CC \uD310\uB2E8", label(r.progressDecision)]])}${r.absenceReason ? `<p class="tiny">\uBE48 \uADFC\uAC70 \uC0AC\uC720: ${esc(r.absenceReason)}</p>` : ""}<div class="read-only-note"><b>\uAD50\uC0AC\uC758 \uD310\uB2E8\uC744 \uC704\uD55C \uC77D\uAE30 \uC704\uCE58</b>\uD604\uC7AC \uD310\uB2E8 ${esc(label(r.teacherVerdict.state))} \xB7 \uBA54\uBAA8 ${esc(r.teacherVerdict.note ?? r.teacherVerdict.memo ?? "\uBBF8\uC81C\uACF5")}<br>\uAD50\uC0AC \uD310\uC815\uC740 \uC815\uD655\uD55C \uC139\uC158\xB7\uBB38\uD56D\xB7\uC751\uC2DC \uBC94\uC704\uC758 \uADFC\uAC70\uC640 \uD568\uAED8 \uBCC4\uB3C4\uB85C \uBCF4\uC874\uD569\uB2C8\uB2E4.</div></section><section><h6>\uCC44\uC810 ${attempts.length}\uAC74 \xB7 \uC6D0\uBCF8 \uB0A0\uC9DC</h6>${attempts.length ? attempts.map((a, i) => `<div class="attempt"><div class="grade">${typeof a.score === "number" ? esc(a.score) : "\u2014"}<small>${typeof a.score === "number" ? "\uC810 \xB7 \uAD00\uCC30\uAC12" : "\uC810\uC218 \uBBF8\uC81C\uACF5"}</small></div>${dl([["\uC6D0\uBCF8 \uB0A0\uC9DC", a.dateRaw ?? "\uBBF8\uC81C\uACF5"], ["\uC5F0\uB3C4\xB7\uC2DC\uAC04\uB300", (a.yearState ?? "unknown") + " / " + (a.timezoneState ?? "unknown")], ["\uC0AC\uAC74 \uC2DC\uAC01", a.occurredAt ?? "null \xB7 \uBBF8\uD655\uC778"], ["\uC720\uD6A8 \uC2DC\uAC01", a.effectiveAt ?? "null \xB7 \uBBF8\uD655\uC778"], ["\uAD00\uCC30 \uC2DC\uAC01", a.observedAt ?? "null \xB7 \uBBF8\uC81C\uACF5"], ["\uAE30\uB85D \uC2DC\uAC01", a.recordedAt ?? "null \xB7 \uBBF8\uC81C\uACF5"], ["\uC751\uC2DC \uACE0\uC720 ID", a.nativeAttemptId ?? "null \xB7 \uBBF8\uC81C\uACF5"], ["\uACB0\uACFC \uC6D0\uBB38", a.sourceResultLabel ?? "\uBBF8\uC81C\uACF5"], ["\uD074\uB9AC\uB2C9 \uC6D0\uBB38", a.clinicText ?? "\uBBF8\uC81C\uACF5"]])}${safe(a.sourceUrl) ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">\uC774 \uCC44\uC810 \uAD00\uCC30\uC758 \uC18C\uC2A4 \u2197</a>` : ""}<details><summary>\uAD00\uCC30 ${i + 1} \uC804\uCCB4 \uC6D0\uBCF8</summary><pre>${raw(a)}</pre></details></div>`).join("") : '<p class="tiny">\uACF5\uAE09\uB41C \uC751\uC2DC \uADFC\uAC70 \uBC30\uC5F4\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uBBF8\uC218\uD589\xB7\uBBF8\uBC30\uC815\uC774\uB77C\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.</p>'}<p class="tiny">100\uC810\uB3C4 \uAD50\uC0AC \uC644\uB8CC \uD310\uC815\uC744 \uB300\uC2E0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>${r.diaryAssertions.length ? `<details><summary>\uC5F0\uACB0\uB41C \uC77C\uC9C0 \uC6D0\uBB38 ${r.diaryAssertions.length}\uAC74</summary>${r.diaryAssertions.map((a) => `<p>${esc(a.dateRaw)} \xB7 ${esc(a.statement)}<br>\uC815\uD655\uD55C \uB300\uC751 ${esc(a.mappingState ?? "\uBBF8\uC81C\uACF5")}<br>${safe(a.sourceUrl) ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">\uC77C\uC9C0 \uCD9C\uCC98 \u2197</a>` : ""}</p>`).join("")}</details>` : ""}</section><section><h6>\uBB38\uD56D\xB7\uB178\uD2B8\xB7\uCD9C\uCC98</h6><div class="question-note">\uBB38\uD56D\uBCC4 \uADFC\uAC70 ${esc(V.questionCoverage.state)}<br>\uAD00\uCC30 \uBB38\uD56D ${esc(V.questionCoverage.observedItemCount)} \xB7 \uC804\uCCB4 \uBB38\uD56D \uBD84\uBAA8 ${esc(V.questionCoverage.totalItems ?? "null")}<br>\uB2F5\uC548 \uC774\uBBF8\uC9C0\xB7\uBB38\uD56D\uBCC4 \uC751\uC2DC\xB7\uCC44\uC810 \uB370\uC774\uD130\uB294 \uACF5\uAE09\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</div>${notebookRows(r)}<p class="tiny">\uC218\uC9D1 \uC790\uB8CC \uC5C6\uC74C\uC740 \uC2E4\uC81C \uB178\uD2B8\xB7\uD480\uC774\uC758 \uBD80\uC7AC\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC815\uD655\uD55C \uBB38\uD56D ID\uB97C \uB9CC\uB4E4\uC5B4 \uB123\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><ul class="source-links">${sourceLinks(r.sourceUrls)}</ul><p class="tiny">\uBAA9\uCC28 \uC2DC\uC791 p.${esc(row.raw.printedStartPage ?? "\uBBF8\uC81C\uACF5")} \xB7 \uADFC\uAC70 PDF p.${esc(row.raw.tocEvidencePdfPage)}<br>\uD559\uC0DD \uC218\uD589 \uAE30\uC900\uC2DC\uAC01 ${esc(V.sourceAsOf.studentPerformance ?? "\uBBF8\uC81C\uACF5")}<br>\uAC1C\uC778 \uD398\uC774\uC9C0\uB294 \uC5F4\uB78C \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.</p></section></div><details><summary>\uC6D0\uBCF8 \uC804\uCCB4\uC640 \uCF54\uB4DC\xB7\uC778\uC1C4 \uB300\uC751 \uD3EC\uC778\uD130</summary><pre>${raw(r)}</pre></details><div class="raw-id">recordId: ${esc(r.recordId)}<br>tocNodeRef: ${esc(r.tocNodeRef)}</div>`;
    }
    function openRecord(summary, open = true) {
      const d = summary.parentElement;
      if (open) {
        summaries().forEach((s) => {
          const p = s.parentElement;
          if (s !== summary) {
            p.open = false;
            s.setAttribute("aria-expanded", "false");
          }
        });
        selectedId = summary.dataset.recordId;
        const body = d.querySelector(".inline-evidence");
        body.innerHTML = detail(records[selectedId]);
        body.setAttribute("role", "region");
        body.setAttribute("aria-label", "\uC120\uD0DD \uC139\uC158\uC758 \uC804\uCCB4 \uADFC\uAC70");
        d.open = true;
        summary.setAttribute("aria-expanded", "true");
        target.querySelector("#c2-status").textContent = records[selectedId].sectionDisplayLabel + " \xB7 \uADFC\uAC70\uB97C \uAC19\uC740 \uD589 \uC544\uB798\uC5D0 \uD3BC\uCCE4\uC2B5\uB2C8\uB2E4.";
      } else {
        d.open = false;
        summary.setAttribute("aria-expanded", "false");
        target.querySelector("#c2-status").textContent = "\uC120\uD0DD \uC139\uC158 \uADFC\uAC70\uB97C \uC811\uC5C8\uC2B5\uB2C8\uB2E4.";
      }
    }
    const click = (e) => {
      const t = e.target;
      const s = t.closest("[data-record-id]");
      if (s && target.contains(s)) {
        e.preventDefault();
        openRecord(s, !s.parentElement.open);
        return;
      }
      const close = t.closest("[data-close-record]");
      if (close) {
        const s2 = close.closest(".record").querySelector("[data-record-id]");
        openRecord(s2, false);
        s2.focus();
        return;
      }
      if (t.closest("[data-expand-majors]")) {
        const all = [...target.querySelectorAll(".major")], open = all.some((d) => !d.open);
        all.forEach((d) => d.open = open);
        target.querySelector("[data-expand-majors]").textContent = open ? "\uBAA8\uB4E0 \uB300\uB2E8\uC6D0 \uC811\uAE30" : "\uBAA8\uB4E0 \uB300\uB2E8\uC6D0 \uD3BC\uCE58\uAE30";
      }
    };
    const keydown = (e) => {
      const s = e.target.closest("[data-record-id]");
      if (!s) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openRecord(s, !s.parentElement.open);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        openRecord(s, false);
        return;
      }
      const all = [...s.closest(".record-stack").querySelectorAll("[data-record-id]")];
      let i = all.indexOf(s);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") i = Math.min(all.length - 1, i + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") i = Math.max(0, i - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = all.length - 1;
      else return;
      e.preventDefault();
      all[i].focus();
      all[i].scrollIntoView({ block: "nearest" });
    };
    target.addEventListener("click", click);
    target.addEventListener("keydown", keydown);
    const first = summaries().find((s) => records[s.dataset.recordId].attemptEvidence.length);
    if (first) openRecord(first);
    return { view: V, getSelectedId: () => selectedId, recordIds: Object.keys(records), tocIds: rows.map((r) => r.id), selectRecord: (id) => {
      const s = summaries().find((s2) => s2.dataset.recordId === id);
      if (s) openRecord(s);
    }, dispose: () => {
      target.removeEventListener("click", click);
      target.removeEventListener("keydown", keydown);
      target.innerHTML = "";
    } };
  }

  // src/client/renderers/teacher-overlay.ts
  var mounted = /* @__PURE__ */ new WeakMap();
  var ownedAttribute = "data-teacher-overlay-owned";
  var complete = (state) => state === "teacher_confirmed_complete";
  var stateText = (state) => complete(state) ? "\uC644\uB8CC" : "\uBBF8\uD655\uC778";
  var present = (value) => value || "\uBBF8\uD655\uC778";
  function validateProjection(overlay) {
    if (!["1.2.0", "1.3.0"].includes(overlay.version) || !/^[a-f0-9]{64}$/.test(overlay.sha256) || !/^[a-f0-9]{64}$/.test(overlay.sourceSnapshotSha256) || !overlay.studentId || !overlay.sourceRevision || !Array.isArray(overlay.candidates)) {
      throw new Error("teacher_overlay_projection_invalid");
    }
    const summary = overlay.summary;
    const counts = [
      summary?.completedOriginalAttempts,
      summary?.completedPathDecisions,
      summary?.deliveryPlannedOriginalAttempts,
      summary?.deliveryPlannedPathCandidates
    ];
    const printed = summary?.actualPrintedSheetCount;
    if (counts.some((n) => typeof n !== "number" || !Number.isInteger(n) || n < 0) || printed !== null && (typeof printed !== "number" || !Number.isInteger(printed) || printed < 0)) {
      throw new Error("teacher_overlay_summary_invalid");
    }
    if ((summary.printedOriginalAttempts !== void 0 || summary.printedPathCandidates !== void 0) && [summary.printedOriginalAttempts, summary.printedPathCandidates].some((n) => typeof n !== "number" || !Number.isInteger(n) || n < 0)) {
      throw new Error("teacher_overlay_summary_invalid");
    }
    const labels = /* @__PURE__ */ new Set(), attempts = /* @__PURE__ */ new Set();
    for (const candidate of overlay.candidates) {
      if (!Number.isInteger(candidate.number) || candidate.number < 1 || candidate.number > 21 || labels.has(candidate.number) || !candidate.sourceRecordKey || !candidate.sourceAttemptKey || attempts.has(candidate.sourceAttemptKey) || [candidate.originalWrongReview, candidate.similarClinicReview].some((s) => s !== void 0 && s !== "unknown" && s !== "teacher_confirmed_complete")) {
        throw new Error("teacher_overlay_candidate_invalid");
      }
      labels.add(candidate.number);
      attempts.add(candidate.sourceAttemptKey);
      const print = candidate.printConfirmation;
      if (print && (print.state !== "user_confirmed_complete" || !print.recordedAt || !print.printedTimeRaw || print.printedAt !== null || print.printedAtState !== "relative_time_only_no_authoritative_timestamp" || !print.sourceMessageId || !print.eventId || print.printedPageCount !== null || print.actualPrintedSheetCount !== null || print.materialIds !== null || print.printHeaderVerified !== false || !Array.isArray(print.remediationPaths) || print.remediationPaths.length !== 2 || !print.remediationPaths.includes("original_wrong") || !print.remediationPaths.includes("similar_clinic"))) {
        throw new Error("teacher_overlay_print_confirmation_invalid");
      }
    }
  }
  function rowText(candidate) {
    const review = `\uAD50\uC0AC \uD655\uC778: \uC6D0\uC624\uB2F5 ${stateText(candidate.originalWrongReview)} \xB7 \uC720\uC0AC\uD074\uB9AC\uB2C9 ${stateText(candidate.similarClinicReview)}`;
    let text2 = review;
    if (candidate.deliveryPlan?.state === "planned") {
      const planned = "\uC6D0\uC624\uB2F5\xB7\uC720\uC0AC\uD074\uB9AC\uB2C9 \uC804\uB2EC \uC608\uC815";
      text2 = complete(candidate.originalWrongReview) || complete(candidate.similarClinicReview) ? `${review} \xB7 ${planned}` : planned;
    }
    if (candidate.printConfirmation?.state === "user_confirmed_complete") {
      text2 += " \xB7 \uC778\uC1C4: \uAD50\uC0AC \uD655\uC778 \uC644\uB8CC (\uC804\uB2EC\xB7\uC218\uB839 \uBBF8\uD655\uC778)";
    }
    return text2;
  }
  var mountTeacherOverlay = attachTeacherOverlay;
  function attachTeacherOverlay(overlay, target) {
    if (overlay !== null) validateProjection(overlay);
    mounted.get(target)?.dispose();
    if (overlay === null) return { refresh() {
    }, afterRecordRender() {
    }, dispose() {
    } };
    const books = target.querySelector("#c2-books");
    if (!books) throw new Error("teacher_overlay_requires_mounted_c2");
    const document2 = target.ownerDocument;
    const groups = /* @__PURE__ */ new Map();
    for (const candidate of overlay.candidates) {
      const group = groups.get(candidate.sourceRecordKey) ?? [];
      group.push(candidate);
      groups.set(candidate.sourceRecordKey, group);
    }
    let disposed = false, pending = false;
    const ownedNodes = /* @__PURE__ */ new Set();
    const own = (node, kind) => {
      node.setAttribute(ownedAttribute, kind);
      ownedNodes.add(node);
      return node;
    };
    const make = (tag, className, text2) => {
      const node = document2.createElement(tag);
      node.className = className;
      if (text2 !== void 0) node.textContent = text2;
      return node;
    };
    const pair = (list, label2, value) => {
      list.append(make("dt", "", label2), make("dd", "", value));
    };
    const active = () => !disposed && target.contains(books);
    const evidenceText = (evidence) => evidence ? `${evidence.evidenceClass} \xB7 \uAE30\uB85D \uC2DC\uAC01 ${present(evidence.recordedAt)}` : "\uADFC\uAC70 \uBBF8\uC81C\uACF5";
    function appendCandidateDetail(section, candidate) {
      const article = make("div", "teacher-overlay-candidate");
      article.append(make("p", "teacher-overlay-detail-state", `#${candidate.number} \xB7 ${rowText(candidate)}`));
      const list = make("dl", "teacher-overlay-fields");
      pair(list, "\uC6D0\uC624\uB2F5 \uAC80\uD1A0", `\uAD50\uC0AC \uD655\uC778 ${stateText(candidate.originalWrongReview)}`);
      pair(list, "\uC720\uC0AC\uD074\uB9AC\uB2C9 \uAC80\uD1A0", `\uAD50\uC0AC \uD655\uC778 ${stateText(candidate.similarClinicReview)}`);
      const plan = candidate.deliveryPlan;
      pair(list, "\uC804\uB2EC \uACC4\uD68D", plan?.state === "planned" ? `${plan.pickupAtLocal} \xB7 ${plan.precision === "approximate" ? "\uB300\uB7B5\uC801\uC778 \uC608\uC815 \uC2DC\uAC01" : "\uC608\uC815 \uC2DC\uAC01"}` : "\uBBF8\uC81C\uACF5");
      const print = candidate.printConfirmation;
      pair(list, "\uAD50\uC0AC \uC778\uC1C4 \uD655\uC778", print?.state === "user_confirmed_complete" ? `\uC644\uB8CC \xB7 \uC0AC\uC6A9\uC790 \uAE30\uB85D \uC2DC\uAC01 ${print.recordedAt}` : "\uBBF8\uD655\uC778");
      if (print) pair(list, "\uC778\uC1C4 \uC2DC\uAC01 \uC6D0\uBB38", `"${print.printedTimeRaw}" (\uC0AC\uC6A9\uC790 \uC6D0\uBB38) \xB7 \uC815\uD655\uD55C \uC778\uC1C4 \uC0AC\uAC74 \uC2DC\uAC01 \uBBF8\uD655\uC778`);
      pair(list, "\uC0DD\uC131 / \uC778\uC1C4 / \uC218\uB839", print?.state === "user_confirmed_complete" ? `\uC0DD\uC131 \uC2DC\uAC01 ${present(plan?.generatedAt)} \xB7 \uC778\uC1C4 \uC2DC\uAC01 ${present(plan?.printedAt)} \xB7 \uC218\uB839 ${present(plan?.deliveredAt)}` : `\uC0DD\uC131 ${present(plan?.generatedAt)} \xB7 \uC778\uC1C4 ${present(plan?.printedAt)} \xB7 \uC218\uB839 ${present(plan?.deliveredAt)}`);
      pair(list, "\uC778\uC1C4\uBB3C \uC874\uC7AC \uADFC\uAC70", candidate.printExistence === "user_confirmed_present" ? "\uAD50\uC0AC \uC0AC\uC6A9\uC790 \uD655\uC778 \xB7 \uC2E4\uBB3C\xB7\uBA38\uB9AC\uAE00\xB7\uCF54\uB4DC \uAC80\uC99D \uBCC4\uB3C4" : candidate.printExistence === "verified" ? "\uBCC4\uB3C4 \uADFC\uAC70\uB85C \uD655\uC778" : "\uBBF8\uD655\uC778");
      pair(list, "\uC778\uACC4 / \uC218\uB839 \uD655\uC778", "\uC778\uACC4 \uBBF8\uD655\uC778 \xB7 \uC218\uB839 \uBBF8\uD655\uC778");
      pair(list, "\uC778\uC1C4 \uBA38\uB9AC\uAE00 / \uCF54\uB4DC", `\uBA38\uB9AC\uAE00 ${candidate.printHeaderVerified ? "\uD655\uC778" : "\uBBF8\uAC80\uC99D"} \xB7 \uCF54\uB4DC ${present(candidate.verifiedPrintTestCode) === "\uBBF8\uD655\uC778" ? "\uBBF8\uAC80\uC99D" : candidate.verifiedPrintTestCode}`);
      article.append(list);
      const source = make("details", "teacher-overlay-provenance");
      source.append(make("summary", "", "\uB300\uC870 \uB300\uC0C1\xB7\uCD9C\uCC98\xB7\uD655\uC778 \uC2DC\uAC01"));
      const fields = make("dl", "teacher-overlay-fields");
      pair(fields, "\uACE0\uC815 \uD6C4\uBCF4 \uBC88\uD638", String(candidate.number));
      pair(fields, "\uC6D0\uBCF8 \uAE30\uB85D \uD0A4", candidate.sourceRecordKey);
      pair(fields, "\uC6D0\uBCF8 \uC751\uC2DC \uD0A4", candidate.sourceAttemptKey);
      pair(fields, "\uC6D0\uBCF8 \uC810\uC218 / \uB0A0\uC9DC", `${candidate.score}\uC810 \xB7 ${candidate.attemptRawDate}`);
      pair(fields, "\uC571 \uBAA9\uB85D \uCF54\uB4DC", `${candidate.appCatalogCode} \xB7 \uC778\uC1C4 \uCF54\uB4DC\uC640\uC758 \uB300\uC751 \uBBF8\uAC80\uC99D`);
      pair(fields, "\uC6D0\uC624\uB2F5 \uD655\uC778 \uADFC\uAC70", evidenceText(candidate.reviewEvidence?.originalWrong));
      pair(fields, "\uC720\uC0AC\uD074\uB9AC\uB2C9 \uD655\uC778 \uADFC\uAC70", evidenceText(candidate.reviewEvidence?.similarClinic));
      if (print) {
        pair(fields, "\uC778\uC1C4 \uD655\uC778 \uCD9C\uCC98", `${print.sourceMessageId} \xB7 ${print.eventId}`);
        pair(fields, "\uC778\uC1C4 \uD655\uC778 \uACBD\uB85C", print.remediationPaths.join(" \xB7 "));
        pair(fields, "\uC778\uC1C4 \uC0AC\uAC74 \uC2DC\uAC01", "null \xB7 \uC0C1\uB300 \uC2DC\uAC01 \uC6D0\uBB38\uB9CC \uBCF4\uC874 (\uC815\uD655\uD55C \uC2DC\uAC01 \uBBF8\uD655\uC778)");
        pair(fields, "\uD398\uC774\uC9C0 / \uC7A5\uC218 / \uC790\uB8CC ID", "null / null / null \xB7 \uBBF8\uD655\uC778");
      }
      pair(fields, "\uD559\uC0DD / \uB9AC\uBE44\uC804", `${overlay.studentId} \xB7 ${overlay.sourceRevision}`);
      pair(fields, "\uAD50\uC0AC \uB300\uC870 SHA-256", overlay.sha256);
      pair(fields, "\uC6D0\uBCF8 \uC2A4\uB0C5\uC0F7 SHA-256", overlay.sourceSnapshotSha256);
      source.append(fields);
      article.append(source);
      section.append(article);
    }
    function restoreInline(recordKey) {
      if (!active()) return;
      for (const row of books.querySelectorAll("[data-record-container]")) {
        const key = row.getAttribute("data-record-container");
        if (recordKey !== void 0 && key !== recordKey) continue;
        const candidates = groups.get(key);
        if (!candidates) continue;
        const body = row.querySelector(".inline-evidence");
        if (!body || ![...body.children].some((node) => !node.hasAttribute(ownedAttribute)) || [...body.children].some((node) => node.getAttribute(ownedAttribute) === "detail")) continue;
        const section = own(make("section", "teacher-overlay-detail"), "detail");
        section.setAttribute("aria-label", "\uB3C5\uB9BD\uB41C \uAD50\uC0AC \uB300\uC870 \uADFC\uAC70");
        section.append(make("h6", "teacher-overlay-detail-title", "\uAD50\uC0AC \uB300\uC870 \xB7 \uBCC4\uB3C4 \uD655\uC778 \uCD95"));
        section.append(make("p", "teacher-overlay-separation", "\uC774 \uB300\uC870\uB294 \uC751\uC2DC\uBCC4 \uC6D0\uC624\uB2F5\xB7\uC720\uC0AC\uD074\uB9AC\uB2C9 \uAC80\uD1A0\uC785\uB2C8\uB2E4. \uC6D0\uBCF8\uC758 \uC139\uC158 \uAD50\uC0AC \uD310\uB2E8\xB7\uC571 \uC810\uC218\xB7\uD074\uB9AC\uB2C9 \uC0C1\uD0DC\uC640 \uBCC4\uB3C4\uB85C \uBCF4\uC874\uD569\uB2C8\uB2E4. \uC810\uC218 100\uC774\uB098 \uAC80\uD1A0 \uADFC\uAC70 \uC5C6\uC74C\uC73C\uB85C \uC644\uB8CC\xB7\uBBF8\uC644\uB8CC\uB97C \uD310\uB2E8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC804\uB2EC \uACC4\uD68D\uC740 \uC2E4\uC81C \uC0DD\uC131\xB7\uC778\uC1C4\xB7\uC218\uB839 \uD655\uC778\uC744 \uB300\uC2E0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        candidates.forEach((candidate) => appendCandidateDetail(section, candidate));
        body.append(section);
      }
    }
    function refresh() {
      if (!active()) return;
      for (const node of ownedNodes) if (!target.contains(node)) ownedNodes.delete(node);
      if (!target.querySelector(`[${ownedAttribute}="summary"]`)) {
        const s = overlay.summary;
        const completed = s.completedPathDecisions === s.completedOriginalAttempts * 2 ? `\uC6D0\uC751\uC2DC ${s.completedOriginalAttempts}\uAC74 \xD7 \uC6D0\uC624\uB2F5\xB7\uC720\uC0AC\uD074\uB9AC\uB2C9 2\uACBD\uB85C \uC644\uB8CC (${s.completedPathDecisions}\uAC74)` : `\uC6D0\uC751\uC2DC ${s.completedOriginalAttempts}\uAC74 \xB7 \uC6D0\uC624\uB2F5\xB7\uC720\uC0AC\uD074\uB9AC\uB2C9 ${s.completedPathDecisions}\uACBD\uB85C \uC644\uB8CC`;
        const printed = s.actualPrintedSheetCount === null ? "\uBBF8\uD655\uC778" : `${s.actualPrintedSheetCount}\uC7A5`;
        const printConfirmation = s.printedOriginalAttempts === void 0 ? "" : ` \xB7 \uC778\uC1C4 \uAD50\uC0AC \uD655\uC778 \uC6D0\uC751\uC2DC ${s.printedOriginalAttempts}\uAC74 \xB7 ${s.printedPathCandidates}\uACBD\uB85C \uD6C4\uBCF4`;
        const summary = own(make("p", "teacher-overlay-summary", `\uAD50\uC0AC \uB300\uC870 v${overlay.version}: ${completed} \xB7 \uC804\uB2EC \uC608\uC815 \uC6D0\uC751\uC2DC ${s.deliveryPlannedOriginalAttempts}\uAC74 \xD7 2\uACBD\uB85C (${s.deliveryPlannedPathCandidates}\uD6C4\uBCF4)${printConfirmation} \xB7 \uC2E4\uC81C \uC778\uC1C4 \uC7A5\uC218 ${printed} \xB7 ${overlay.sourceRevision} \uC751\uC2DC\uBCC4 \uB300\uC870 (\uC6D0\uBCF8 \uC139\uC158 \uD310\uB2E8 \uBCC4\uB3C4)`), "summary");
        summary.setAttribute("aria-label", "\uAD50\uC0AC \uB300\uC870 \uC694\uC57D");
        books.before(summary);
      }
      for (const row of books.querySelectorAll("[data-record-container]")) {
        const candidates = groups.get(row.getAttribute("data-record-container"));
        const label2 = row.querySelector(".record-summary .record-label");
        if (!candidates || !label2 || label2.querySelector(`[${ownedAttribute}="row"]`)) continue;
        const badges = own(make("span", "teacher-overlay-row"), "row");
        for (const candidate of candidates) {
          const badge = make("span", "teacher-overlay-row-entry");
          badge.append(make("span", "teacher-overlay-number", `#${candidate.number}`), make("span", "teacher-overlay-row-state", rowText(candidate)));
          badges.append(badge);
        }
        label2.append(badges);
      }
      restoreInline();
    }
    function scheduleRestore() {
      if (pending || !active()) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (active()) refresh();
      });
    }
    const delegated = (event) => {
      const node = event.target;
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (element?.closest("[data-record-id], [data-close-record]")) scheduleRestore();
    };
    target.addEventListener("click", delegated);
    target.addEventListener("keydown", delegated);
    const Observer = document2.defaultView?.MutationObserver;
    const observer = Observer ? new Observer((mutations) => {
      if (!active()) {
        dispose2();
        return;
      }
      if (mutations.some((mutation) => {
        const element = mutation.target;
        return element.nodeType === 1 && element.matches(".inline-evidence") && [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType !== 1 || !node.hasAttribute(ownedAttribute));
      })) scheduleRestore();
    }) : null;
    function dispose2() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      target.removeEventListener("click", delegated);
      target.removeEventListener("keydown", delegated);
      for (const node of ownedNodes) node.remove();
      ownedNodes.clear();
      if (mounted.get(target) === handle) mounted.delete(target);
    }
    const handle = { refresh, afterRecordRender: restoreInline, dispose: dispose2 };
    mounted.set(target, handle);
    refresh();
    observer?.observe(target, { childList: true, subtree: true });
    return handle;
  }

  // src/client/renderers/included-contents.ts
  function mountIncludedContents(projection, target) {
    const owned = [];
    const doc = target.ownerDocument;
    for (const content of projection.includedContents) {
      const parent = content.parentSourceRecordId ? Array.from(target.querySelectorAll("[data-record-container]")).find((e) => e.dataset.recordContainer === content.parentSourceRecordId) : null;
      const unit = Array.from(target.querySelectorAll("[data-toc-node]")).find((e) => e.dataset.tocNode === content.tocNodeRef);
      if (!unit) throw Error("included_content_unit_not_rendered");
      const note = doc.createElement("p");
      note.className = "included-content-note";
      note.setAttribute("data-included-source-record", content.sourceRecordKey);
      note.setAttribute("data-inclusion-binding", content.nativeBindingState);
      note.textContent = content.parentCatalogCode ? `${content.printedSourceLabel}: ${content.parentLessonIndex}\uCC28\uC2DC (${content.parentCatalogCode})\uC5D0 \uD3EC\uD568 \xB7 \uBCC4\uB3C4 \uAE30\uB85D\uCE78\xB7\uC644\uB8CC \uBD84\uBAA8 \uC5C6\uC74C \xB7 \uC0AC\uC6A9\uC790 \uD3EC\uD568 \uBCF4\uACE0 \xB7 \uC11C\uBC84 \uC9C1\uC811\uAC80\uC99D \uC804` : `${content.printedSourceLabel}: \uC18C\uB2E8\uC6D0 \uB9C8\uC9C0\uB9C9 \uCC28\uC2DC\uC5D0 \uD3EC\uD568 \xB7 \uBCC4\uB3C4 \uAE30\uB85D\uCE78\xB7\uC644\uB8CC \uBD84\uBAA8 \uC5C6\uC74C \xB7 \uB9C8\uC9C0\uB9C9 \uCC28\uC2DC native \uC5F0\uACB0 \uBBF8\uD655\uC778`;
      if (parent) parent.insertAdjacentElement("afterend", note);
      else unit.querySelector(".unit-head")?.insertAdjacentElement("afterend", note);
      owned.push(note);
    }
    return { dispose() {
      for (const note of owned) note.remove();
    } };
  }

  // src/client/renderers/desktop-stepper.ts
  var stages = [
    { id: "preview", label: "\uC608\uC2B5", eyebrow: "\uAD50\uC7AC\uC640 \uBC94\uC704", title: "\uBC30\uC815\uACFC \uAD50\uC7AC\uBD80\uD130 \uD655\uC778\uD574\uC694", description: "\uB4F1\uB85D\uB41C \uAD50\uC7AC\uC640 \uBCF4\uC874\uB41C \uACFC\uC81C\uB97C \uC0B4\uD3B4\uBCF4\uC138\uC694. \uC608\uC2B5 \uC218\uD589 \uC5EC\uBD80\uB294 \uC544\uC9C1 \uBCC4\uB3C4 \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." },
    { id: "practice", label: "\uD480\uC774", eyebrow: "\uD480\uC774\uC640 \uCC44\uC810", title: "\uD480\uC774\uC758 \uADFC\uAC70\uB97C \uD55C\uACF3\uC5D0\uC11C", description: "\uC800\uC7A5\uB41C \uCC44\uC810 \uAD00\uCC30\uC744 \uC6D0\uBCF8 \uB0A0\uC9DC\uC640 \uD568\uAED8 \uBD05\uB2C8\uB2E4. \uC810\uC218\uB294 \uD559\uC2B5 \uC644\uB8CC \uD310\uC815\uACFC \uAD6C\uBD84\uD569\uB2C8\uB2E4." },
    { id: "review", label: "\uC624\uB2F5", eyebrow: "\uC624\uB2F5\uACFC \uD074\uB9AC\uB2C9", title: "\uC624\uB2F5 \uAC80\uD1A0\uC758 \uADFC\uAC70\uB97C \uD655\uC778\uD574\uC694", description: "\uC6D0\uBB38 \uC624\uB2F5\uACFC \uC720\uC0AC \uD074\uB9AC\uB2C9\uC744 \uB098\uB220 \uBD05\uB2C8\uB2E4. \uAD50\uC0AC\uAC00 \uD655\uC778\uD55C \uBC94\uC704\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4." },
    { id: "teacher", label: "\uAD50\uC0AC \uAC80\uD1A0", eyebrow: "\uAD50\uC0AC\uC758 \uB3C5\uB9BD\uB41C \uD310\uB2E8", title: "\uD655\uC778\uD55C \uAC83\uACFC \uB0A8\uC740 \uAC83\uC744 \uAD6C\uBD84\uD574\uC694", description: "\uC800\uC7A5\uB41C \uAD50\uC0AC \uD655\uC778\uC744 \uC0B4\uD3B4\uBCF4\uC138\uC694. \uAC80\uD1A0 \uC644\uB8CC, \uC778\uC1C4, \uBC30\uBD80\uB294 \uAC01\uAC01 \uB2E4\uB978 \uC0C1\uD0DC\uC785\uB2C8\uB2E4." }
  ];
  var text = (value, fallback = "\uBBF8\uD655\uC778") => typeof value === "string" && value.length ? value : fallback;
  var reviewText = (state) => state === "teacher_confirmed_complete" ? "\uAD50\uC0AC \uC644\uB8CC \uD655\uC778" : "\uBBF8\uD655\uC778";
  function mountDesktopStepper(shell2, root2, extra2, options) {
    const doc = shell2.ownerDocument, win = doc.defaultView;
    const media = win?.matchMedia("(min-width: 1100px)");
    let stage = "preview", active = false, disposed = false, search = "", page = 0;
    let sidebar = null, workspace = null, drawers = null;
    let pane = null, tabs = null, live = null;
    const restores = [];
    const make = (tag, className = "", value) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (value !== void 0) node.textContent = value;
      return node;
    };
    const button = (label2, cls, action) => {
      const node = make("button", cls, label2);
      node.type = "button";
      node.addEventListener("click", action);
      return node;
    };
    const allRecords = Object.values(options.view.records);
    const attempts = allRecords.filter((record) => record.attemptEvidence.length > 0);
    const candidates = options.teacherOverlay?.candidates ?? [];
    const relocate = (node, parent) => {
      if (!node) return;
      const placeholder = doc.createComment("desktop-restore");
      node.before(placeholder);
      restores.push({ node, placeholder });
      parent.append(node);
    };
    const jump = (target) => {
      if (!target) return;
      for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
      target.scrollIntoView?.({ behavior: win?.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (target.matches("button,a,summary,[tabindex]")) target.focus({ preventScroll: true });
    };
    const openRecord = (id) => {
      options.selectRecord(id);
      const target = Array.from(root2.querySelectorAll("[data-record-id]")).find((node) => node.dataset.recordId === id) ?? null;
      jump(target);
    };
    function badge(label2, kind = "unknown") {
      return make("span", "desktop-badge desktop-badge--" + kind, label2);
    }
    function item(label2, sub, meta, action) {
      const row = make("article", "desktop-evidence-item"), body = make("div", "desktop-item-copy");
      body.append(make("h3", "", label2), make("p", "", sub));
      row.append(body, make("span", "desktop-item-meta", meta), button("\uADFC\uAC70 \uBCF4\uAE30 \u2197", "desktop-item-open", action));
      return row;
    }
    function renderPane() {
      if (!pane || !tabs) return;
      const selected2 = stages.find((entry) => entry.id === stage);
      tabs.style.setProperty("--selected-step", String(stages.indexOf(selected2)));
      for (const tab of tabs.querySelectorAll("[data-desktop-stage]")) {
        const selected3 = tab.dataset.desktopStage === stage;
        tab.setAttribute("aria-selected", String(selected3));
        tab.tabIndex = selected3 ? 0 : -1;
        tab.dataset.state = selected3 ? "active" : "idle";
      }
      pane.setAttribute("aria-labelledby", "desktop-step-" + stage);
      pane.dataset.stage = stage;
      pane.replaceChildren();
      const heading = make("div", "desktop-pane-heading"), copy = make("div");
      copy.append(make("p", "desktop-eyebrow", selected2.eyebrow), make("h2", "", selected2.title), make("p", "desktop-pane-description", selected2.description));
      heading.append(copy, badge("\uC800\uC7A5 \uADFC\uAC70 \uD0D0\uC0C9"));
      const grid = make("div", "desktop-pane-grid"), main = make("section", "desktop-stage-evidence"), context = make("aside", "desktop-stage-context");
      if (stage === "preview") {
        main.append(make("div", "desktop-section-heading", "\uB4F1\uB85D \uAD50\uC7AC"));
        const books = make("div", "desktop-book-grid");
        for (const [index2, book] of options.view.books.entries()) {
          const card = button("", "desktop-book-card", () => jump(root2.querySelector("#c2-book-" + index2)));
          const cover = make("span", "desktop-book-cover"), spine = make("span", "desktop-book-spine", String(index2 + 1).padStart(2, "0"));
          cover.append(spine, make("span", "desktop-book-cover-label", text(book.raw.bookCode, "\uAD50\uC7AC")));
          const copy2 = make("span", "desktop-book-copy");
          copy2.append(make("strong", "", text(book.label)), make("span", "", `\uD310\uBCF8 ${book.edition ?? "\uBBF8\uD655\uC778"} \xB7 \uC800\uC7A5 \uBAA9\uCC28`), make("span", "desktop-card-link", "\uAD50\uC7AC \uADFC\uAC70 \uC5F4\uAE30 \u2197"));
          card.append(cover, copy2);
          books.append(card);
        }
        if (!options.view.books.length) books.append(make("p", "desktop-empty", "\uB4F1\uB85D \uAD50\uC7AC \uADFC\uAC70\uAC00 \uACF5\uAE09\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uBBF8\uBC30\uC815\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        main.append(books);
        const saved = make("div", "desktop-saved-prompt");
        saved.append(make("div", "", "\uC624\uB298 \uACFC\uC81C\uC640 \uAD50\uC0AC \uBCF4\uACE0"), make("p", "", "\uCD5C\uADFC \uBCF4\uC874\uB41C \uACC4\uD68D\uACFC \uACFC\uC81C\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC218\uD589\uACFC \uC644\uB8CC \uC5EC\uBD80\uB294 \uAC01 \uC6D0\uBB38\uC744 \uAE30\uC900\uC73C\uB85C \uBD05\uB2C8\uB2E4."), button("\uC800\uC7A5 \uC694\uC57D \uD655\uC778", "desktop-primary", () => {
          const details = shell2.querySelector(".legacy-today-detail");
          if (details) details.open = true;
          jump(details?.querySelector("[data-today-summary]") ?? null);
        }));
        main.append(saved);
        context.append(make("p", "desktop-context-kicker", "\uC774 \uB2E8\uACC4\uC758 \uD655\uC778 \uBC94\uC704"), make("h3", "", "\uC608\uC2B5 \uC218\uD589\uC740 \uBBF8\uD655\uC778"), make("p", "", "\uAD50\uC7AC \uB4F1\uB85D\uACFC \uC608\uC2B5 \uC644\uB8CC\uB294 \uBCC4\uAC1C\uC785\uB2C8\uB2E4. \uC815\uD655\uD55C \uACFC\uC81C \uBC94\uC704\uC640 \uC218\uD589 \uADFC\uAC70\uB97C \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694."), make("div", "desktop-context-rule"), make("span", "desktop-context-label", "\uAE30\uC900 \uC790\uB8CC"), make("strong", "", "\uC120\uD0DD \uD559\uC0DD\uC758 \uC800\uC7A5\uBCF8"), make("p", "desktop-small", "\uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uC7AC\uC870\uD68C \uC5C6\uC74C"));
      } else {
        let renderList2 = function() {
          list.replaceChildren();
          pagination.replaceChildren();
          const needle = search.trim().toLocaleLowerCase();
          const records = stage === "practice" ? attempts : candidates;
          const filtered = records.filter((record) => {
            const source = stage === "practice" ? record : options.view.records[record.sourceRecordKey];
            return !needle || [source?.bookDisplayName, source?.unitTitle, source?.sectionDisplayLabel, source?.catalogCode, record.appCatalogCode].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
          });
          const limit = 5, start = page * limit, visible = filtered.slice(start, start + limit);
          for (const entry of visible) {
            if (stage === "practice") {
              const scores = entry.attemptEvidence.filter((attempt) => typeof attempt.score === "number").map((attempt) => `${attempt.score}\uC810`).join(" / ") || "\uC810\uC218 \uBBF8\uC81C\uACF5";
              const row = item(text(entry.sectionDisplayLabel), `${text(entry.unitTitle)} \xB7 ${text(entry.catalogCode, "\uCF54\uB4DC \uBBF8\uAD00\uCC30")}`, scores, () => openRecord(entry.recordId));
              row.dataset.desktopRecordId = entry.recordId;
              row.querySelector(".desktop-item-copy").append(make("small", "", entry.attemptEvidence.map((attempt) => text(attempt.dateRaw, "\uB0A0\uC9DC \uBBF8\uC81C\uACF5")).join(" / ")));
              list.append(row);
            } else {
              const source = options.view.records[entry.sourceRecordKey], row = item(text(source?.sectionDisplayLabel, entry.appCatalogCode), `${text(source?.unitTitle)} \xB7 ${entry.appCatalogCode}`, `${entry.score}\uC810 \xB7 ${entry.attemptRawDate}`, () => openRecord(entry.sourceRecordKey));
              row.dataset.desktopRecordId = entry.sourceRecordKey;
              const states2 = make("div", "desktop-review-states");
              states2.append(badge("\uC6D0\uBB38 \uC624\uB2F5 \xB7 " + reviewText(entry.originalWrongReview), entry.originalWrongReview === "teacher_confirmed_complete" ? "verified" : "unknown"), badge("\uC720\uC0AC \uD074\uB9AC\uB2C9 \xB7 " + reviewText(entry.similarClinicReview), entry.similarClinicReview === "teacher_confirmed_complete" ? "verified" : "unknown"));
              row.querySelector(".desktop-item-copy").append(states2);
              if (stage === "teacher") {
                const meta = make("p", "desktop-review-provenance", `\uC0AC\uC6A9\uC790 \uD655\uC778 \uADFC\uAC70 \xB7 \uC778\uC1C4 ${entry.printConfirmation ? "\uC0AC\uC6A9\uC790 \uC644\uB8CC \uD655\uC778" : "\uBBF8\uD655\uC778"} \xB7 \uBC30\uBD80 ${entry.deliveryPlan ? "\uC608\uC815, \uC644\uB8CC \uBBF8\uD655\uC778" : "\uBBF8\uD655\uC778"}`);
                row.querySelector(".desktop-item-copy").append(meta);
              }
              list.append(row);
            }
          }
          if (!filtered.length) list.append(make("div", "desktop-empty", needle ? "\uAC80\uC0C9\uC5B4\uC640 \uC77C\uCE58\uD558\uB294 \uC800\uC7A5 \uADFC\uAC70\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." : stage === "practice" ? "\uC774 \uC800\uC7A5\uBCF8\uC5D0 \uCC44\uC810 \uAD00\uCC30\uC774 \uC5F0\uACB0\uB41C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uBBF8\uC218\uD589\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC774 \uD559\uC0DD\uC5D0\uAC8C \uC5F0\uACB0\uB41C \uBCC4\uB3C4 \uAD50\uC0AC \uAC80\uD1A0 \uADFC\uAC70\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAC80\uD1A0 \uBBF8\uC2E4\uC2DC\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
          const previous = button("\u2190 \uC774\uC804", "desktop-secondary", () => {
            page--;
            renderList2();
            list.focus({ preventScroll: true });
          }), next = button("\uB2E4\uC74C \u2192", "desktop-secondary", () => {
            page++;
            renderList2();
            list.focus({ preventScroll: true });
          });
          previous.disabled = page === 0;
          next.disabled = start + limit >= filtered.length;
          pagination.append(make("span", "", `${filtered.length ? start + 1 : 0}\u2013${Math.min(start + limit, filtered.length)} / \uC800\uC7A5 \uADFC\uAC70 ${filtered.length}\uAC74`), previous, next);
        };
        var renderList = renderList2;
        const title = stage === "practice" ? "\uCC44\uC810 \uADFC\uAC70\uAC00 \uC788\uB294 \uAE30\uB85D" : stage === "review" ? "\uC624\uB2F5\xB7\uD074\uB9AC\uB2C9 \uAC80\uD1A0 \uADFC\uAC70" : "\uAD50\uC0AC \uD655\uC778 \uC6D0\uBB38";
        const listHeading = make("div", "desktop-list-heading");
        listHeading.append(make("h3", "", title));
        const filter = make("input", "desktop-search");
        filter.type = "search";
        filter.placeholder = "\uAD50\uC7AC \xB7 \uB2E8\uC6D0 \xB7 \uCF54\uB4DC \uCC3E\uAE30";
        filter.setAttribute("aria-label", "\uC774 \uB2E8\uACC4\uC758 \uC800\uC7A5 \uADFC\uAC70 \uAC80\uC0C9");
        filter.value = search;
        filter.addEventListener("input", () => {
          search = filter.value;
          page = 0;
          renderList2();
        });
        listHeading.append(filter);
        main.append(listHeading);
        const list = make("div", "desktop-evidence-list"), pagination = make("div", "desktop-pagination");
        list.tabIndex = -1;
        list.setAttribute("role", "region");
        list.setAttribute("aria-label", title + " \uBAA9\uB85D");
        main.append(list, pagination);
        renderList2();
        context.append(make("p", "desktop-context-kicker", "\uD310\uB2E8\uC758 \uAE30\uC900"), make("h3", "", stage === "practice" ? "\uC810\uC218\uC640 \uC644\uB8CC\uB294 \uBCC4\uAC1C" : stage === "review" ? "\uB450 \uAC80\uD1A0 \uACBD\uB85C\uB97C \uAD6C\uBD84" : "\uC644\uB8CC \uADFC\uAC70\uB294 \uC6D0\uBB38\uB300\uB85C"), make("p", "", stage === "practice" ? "\uCC44\uC810 \uC810\uC218\uC640 \uB0A0\uC9DC\uB294 \uC800\uC7A5 \uAD00\uCC30\uAC12\uC785\uB2C8\uB2E4. 100\uC810\uC774\uC5B4\uB3C4 \uAD50\uC0AC \uC644\uB8CC \uD310\uC815\uC744 \uB300\uC2E0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : stage === "review" ? "\uC6D0\uBB38 \uC624\uB2F5\uACFC \uC720\uC0AC \uD074\uB9AC\uB2C9\uC758 \uAD50\uC0AC \uD655\uC778\uC744 \uAC01\uAC01 \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC778\uC1C4 \uB610\uB294 \uBC30\uBD80 \uACC4\uD68D\uC744 \uAC80\uD1A0 \uC644\uB8CC\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC0AC\uC6A9\uC790\uAC00 \uD655\uC778\uD55C \uAC80\uD1A0 \uBC94\uC704\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC6D0\uBB38 \uB0A0\uC9DC, \uAE30\uB85D \uC2DC\uAC01, \uC644\uB8CC \uC2DC\uAC01\uC744 \uC11C\uB85C \uB300\uC2E0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."), make("div", "desktop-context-rule"), make("span", "desktop-context-label", "\uD604\uC7AC \uD0D0\uC0C9"), make("strong", "", selected2.label), make("p", "desktop-small", "\uC774 \uB2E8\uACC4 \uC120\uD0DD\uC740 \uC644\uB8CC \uAE30\uB85D\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        context.append(button("\uC804\uCCB4 \uAD50\uC7AC \uADFC\uAC70 \uBCF4\uAE30 \u2197", "desktop-text-button", () => jump(root2.querySelector("#c2-books"))));
      }
      grid.append(main, context);
      pane.append(heading, grid);
      const footer = make("div", "desktop-stepper-footer");
      footer.append(make("p", "", "\uB2E8\uACC4\uB294 \uD0D0\uC0C9\uC6A9\uC785\uB2C8\uB2E4. \uD559\uC2B5 \uC0C1\uD0DC\uC640 \uC644\uB8CC \uADFC\uAC70\uB294 \uC6D0\uBB38\uC5D0 \uB530\uB985\uB2C8\uB2E4."));
      const index = stages.findIndex((entry) => entry.id === stage);
      const controls = make("div", "desktop-stepper-actions");
      if (index > 0) controls.append(button("\u2190 " + stages[index - 1].label, "desktop-secondary", () => selectStage(stages[index - 1].id, true)));
      if (index < stages.length - 1) controls.append(button(stages[index + 1].label + " \uC0B4\uD3B4\uBCF4\uAE30 \u2192", "desktop-primary", () => selectStage(stages[index + 1].id, true)));
      else controls.append(button("\uC608\uC2B5\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30 \u2197", "desktop-secondary", () => selectStage("preview", true)));
      footer.append(controls);
      pane.append(footer);
    }
    function selectStage(next, focus = false) {
      if (!active || !stages.some((entry) => entry.id === next)) return;
      stage = next;
      search = "";
      page = 0;
      renderPane();
      if (live) live.textContent = stages.find((entry) => entry.id === stage).label + " \uADFC\uAC70 \uD0D0\uC0C9. \uD559\uC2B5 \uC0C1\uD0DC\uB294 \uBCC0\uACBD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
      if (focus) tabs?.querySelector('[aria-selected="true"]')?.focus();
    }
    function activate() {
      if (active || disposed) return;
      const inner = shell2.querySelector(".shell-inner");
      if (!inner) return;
      active = true;
      doc.body.classList.add("desktop-academy");
      root2.dataset.desktopEvidenceRail = "";
      extra2.dataset.desktopEvidenceRail = "";
      sidebar = make("aside", "desktop-sidebar");
      sidebar.setAttribute("aria-label", "\uD559\uC0DD \uC791\uC5C5 \uACF5\uAC04");
      const brand = make("div", "desktop-brand");
      brand.append(make("span", "desktop-brand-symbol", "k"), make("span", "", "\uD559\uC2B5 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4"));
      sidebar.append(brand, make("p", "desktop-sidebar-label", "\uD559\uC0DD"));
      relocate(inner.querySelector(".student-nav"), sidebar);
      const sidebarFoot = make("div", "desktop-sidebar-footer");
      sidebarFoot.append(make("span", "desktop-private-dot"), make("span", "", "\uBCF8\uC778 \uC804\uC6A9 \xB7 \uC77D\uAE30 \uD654\uBA74"));
      sidebar.append(sidebarFoot);
      const originalTitle = inner.querySelector(".app-title");
      if (originalTitle) {
        relocate(originalTitle, sidebar);
        originalTitle.classList.add("desktop-original-title");
      }
      workspace = make("section", "desktop-workspace");
      workspace.dataset.desktopStepper = "";
      workspace.setAttribute("aria-label", "\uD559\uC2B5 \uB2E8\uACC4\uBCC4 \uADFC\uAC70 \uD0D0\uC0C9");
      const topbar = make("div", "desktop-topbar");
      topbar.append(make("p", "", "\uD559\uC0DD \uD559\uC2B5 / " + options.studentName), badge("\uC800\uC7A5 \uC790\uB8CC \xB7 \uC2E4\uC2DC\uAC04 \uBBF8\uC5F0\uACB0"));
      const heading = make("div", "desktop-workspace-heading"), copy = make("div");
      copy.append(make("p", "desktop-eyebrow", "LEARNING WORKSPACE"), make("h1", "", options.studentName + "\uC758 \uD559\uC2B5 \uD655\uC778"), make("p", "", "\uD544\uC694\uD55C \uB2E8\uACC4\uC5D0 \uC9D1\uC911\uD558\uACE0, \uD310\uB2E8\uC740 \uADFC\uAC70\uC640 \uD568\uAED8."));
      const source = make("a", "desktop-source-link", "\uD559\uC0DD \uC6D0\uBCF8 \u2197");
      source.href = options.sourceRecordPath;
      source.rel = "noopener noreferrer";
      heading.append(copy, source);
      const frame = make("div", "desktop-stepper-frame");
      tabs = make("div", "desktop-stepper-tabs");
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "\uD559\uC2B5 \uB2E8\uACC4 \uD0D0\uC0C9, \uC644\uB8CC \uC0C1\uD0DC \uC544\uB2D8");
      tabs.append(make("span", "desktop-step-glider"));
      stages.forEach((entry, index) => {
        const tab = button("", "desktop-step", () => selectStage(entry.id));
        tab.id = "desktop-step-" + entry.id;
        tab.dataset.desktopStage = entry.id;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", "desktop-stage-panel");
        tab.append(make("span", "desktop-step-number", String(index + 1)), make("span", "desktop-step-label", entry.label));
        tab.addEventListener("keydown", (event) => {
          let target = index;
          if (event.key === "ArrowRight") target = (index + 1) % stages.length;
          else if (event.key === "ArrowLeft") target = (index + stages.length - 1) % stages.length;
          else if (event.key === "Home") target = 0;
          else if (event.key === "End") target = stages.length - 1;
          else return;
          event.preventDefault();
          selectStage(stages[target].id, true);
        });
        tabs.append(tab);
      });
      pane = make("div", "desktop-stepper-pane");
      pane.id = "desktop-stage-panel";
      pane.setAttribute("role", "tabpanel");
      pane.tabIndex = 0;
      live = make("div", "desktop-sr-only");
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      frame.append(tabs, pane);
      workspace.append(topbar, heading);
      relocate(inner.querySelector(".student-event-view"), workspace);
      workspace.append(frame, live);
      drawers = make("div", "desktop-context-drawers");
      const work2 = make("details", "desktop-drawer"), provenance = make("details", "desktop-drawer");
      work2.append(make("summary", "", "\uC218\uC5C5 \uBC30\uC815 \xB7 \uC5C5\uBB34 \uAE30\uC900"));
      provenance.append(make("summary", "", "\uC790\uB8CC \uBC94\uC704 \xB7 \uC870\uD68C \uC2DC\uAC01 \xB7 \uC5F0\uACB0 \uC0C1\uD0DC"));
      relocate(inner.querySelector(".workflow-view"), work2);
      relocate(inner.querySelector(".refresh-state"), provenance);
      relocate(inner.querySelector(".coverage-details"), provenance);
      relocate(inner.querySelector(".refresh-readiness"), provenance);
      drawers.append(work2);
      relocate(inner.querySelector(".legacy-today-detail"), drawers);
      drawers.append(provenance);
      inner.prepend(sidebar, workspace);
      inner.append(drawers);
      renderPane();
    }
    function deactivate() {
      if (!active) return;
      const focusWasInDesktop = !!(workspace?.contains(doc.activeElement) || sidebar?.contains(doc.activeElement));
      active = false;
      for (const { node, placeholder } of restores.splice(0)) {
        if (placeholder.parentNode) placeholder.replaceWith(node);
        else node.remove();
        node.classList.remove("desktop-original-title");
      }
      sidebar?.remove();
      workspace?.remove();
      drawers?.remove();
      sidebar = workspace = drawers = pane = tabs = live = null;
      doc.body.classList.remove("desktop-academy");
      delete root2.dataset.desktopEvidenceRail;
      delete extra2.dataset.desktopEvidenceRail;
      if (focusWasInDesktop) shell2.querySelector('[data-student-id][aria-pressed="true"]')?.focus({ preventScroll: true });
    }
    const onChange = () => {
      if (media?.matches) activate();
      else deactivate();
    };
    media?.addEventListener("change", onChange);
    onChange();
    return { selectStage, getStage: () => stage, get active() {
      return active;
    }, dispose() {
      if (disposed) return;
      disposed = true;
      media?.removeEventListener("change", onChange);
      deactivate();
    } };
  }

  // src/client/renderers/student-event-view.ts
  var stateLabels = { unknown: "\uBBF8\uD655\uC778", planned: "\uC608\uC815", in_progress: "\uC9C4\uD589 \uC911", complete: "\uC644\uB8CC \uBCF4\uACE0", incomplete: "\uBBF8\uC644\uB8CC \uBCF4\uACE0", not_performed: "\uBBF8\uC2E4\uC2DC \uBCF4\uACE0", conditional: "\uC870\uAC74\uBD80 \uC608\uC815", cancelled: "\uCDE8\uC18C", conflicted: "\uADFC\uAC70 \uC0C1\uCDA9" };
  var assignmentLabels = { unknown: "\uBC30\uC815 \uC0C1\uD0DC \uBBF8\uD655\uC778", planned: "\uC219\uC81C \uACC4\uD68D", teacher_confirmed: "\uC219\uC81C \uD655\uC815", issued_user_report: "\uBC30\uC815 \uC644\uB8CC \uBCF4\uACE0", cancelled: "\uCDE8\uC18C", conflicted: "\uADFC\uAC70 \uC0C1\uCDA9" };
  function string(value) {
    if (typeof value !== "string" || value.length > 8e3) throw Error("invalid_student_event_text");
    return value;
  }
  function validateStudentEventView(value, selectedStudentId) {
    if (!value || value.schemaVersion !== "academy.student-current/2.0.0" || value.sourceMode !== "local_sqlite" || value.liveRefreshConnected !== false || value.executionAuthorityGranted !== false || value.verification?.storageScopeChecked !== true || value.verification?.sourceIdentityIndependentlyVerified !== false || !Array.isArray(value.studentIds) || new Set(value.studentIds).size !== value.studentIds.length) throw Error("invalid_student_event_projection");
    if (selectedStudentId && (value.studentIds.length !== 1 || value.studentIds[0] !== selectedStudentId)) throw Error("student_event_view_scope_mismatch");
    for (const name of ["assignments", "checklist", "schedules", "references", "conflicts", "sourceEvidence", "attendance", "dateCohorts"]) if (!Array.isArray(value[name]) || value[name].length > 200) throw Error("invalid_student_event_list");
    for (const row of [...value.assignments, ...value.checklist, ...value.schedules, ...value.references, ...value.conflicts, ...value.sourceEvidence, ...value.attendance]) if (!value.studentIds.includes(row.studentId)) throw Error("student_event_row_scope_mismatch");
    for (const a of value.assignments) {
      if (!Object.hasOwn(assignmentLabels, a.assignmentStatus) || a.studentCompletion !== "unknown" || a.lmsEntry !== "unknown" || a.parentMessageSent !== "unknown") throw Error("invalid_assignment_state");
      string(a.label);
      string(a.displayName);
      if (a.effectiveDue !== null && a.effectiveDue?.date !== null && !/^\d{4}-\d\d-\d\d$/.test(a.effectiveDue?.date ?? "")) throw Error("invalid_effective_due");
    }
    for (const row of value.checklist) {
      if (!Object.hasOwn(stateLabels, row.state) || row.checked !== (row.state === "complete") || row.authorityGranted !== false) throw Error("invalid_stage_state");
      string(row.labelRaw);
      string(row.displayName);
    }
    if (value.workflowCoverage !== void 0) {
      if (!Array.isArray(value.workflowCoverage) || value.workflowCoverage.length > 200) throw Error("invalid_workflow_coverage");
      for (const a of value.workflowCoverage) {
        if (!value.studentIds.includes(a.studentId) || a.definitionOnly !== true || a.createsAssignment !== false || !Array.isArray(a.checkpoints) || a.checkpoints.length > 30) throw Error("invalid_workflow_coverage_scope");
        string(a.label);
        for (const c of a.checkpoints) {
          if (!["required", "waived", "deferred", "unknown"].includes(c.applicability) || !(Object.hasOwn(stateLabels, c.state) || c.state === "not_started") || c.checked !== (c.state === "complete") || c.blocksNextStep !== false || c.authorityGranted !== false) throw Error("invalid_workflow_checkpoint");
          string(c.label);
          string(c.reason);
        }
      }
    }
    for (const row of value.schedules) if (!Array.isArray(row.claims) || !row.claims.length || row.claims.some((e) => e.kind !== "schedule_assertion" || e.actualOccurredAt !== null || !/^\d{4}-\d\d-\d\d$/.test(e.date))) throw Error("invalid_planned_schedule");
    for (const row of value.attendance) if (!Array.isArray(row.claims) || !row.claims.length || row.claims.some((e) => e.kind !== "attendance_assertion" || e.regularMembershipChanged !== false || !/^\d{4}-\d\d-\d\d$/.test(e.date))) throw Error("invalid_actual_attendance");
    for (const c of value.dateCohorts) if (!Array.isArray(c.members) || c.members.some((m) => !value.studentIds.includes(m.studentId))) throw Error("cohort_student_scope_mismatch");
    return value;
  }
  function mountStudentEventView(target, value, selectedStudentId) {
    const data = validateStudentEventView(value, selectedStudentId), doc = target.ownerDocument, section = doc.createElement("section");
    section.className = "student-event-view";
    section.setAttribute("aria-label", "\uCD5C\uC2E0 \uBCF4\uC874 \uACFC\uC81C\uC640 \uAD50\uC0AC \uBCF4\uACE0");
    const add = (parent, tag, text2) => {
      const n = doc.createElement(tag);
      n.textContent = text2;
      parent.append(n);
      return n;
    };
    add(section, "h2", "\uCD5C\uC2E0 \uACFC\uC81C\xB7\uAD50\uC0AC \uBCF4\uACE0");
    add(section, "p", "\uB3C5\uB9BD SQLite \uC800\uC7A5\uBCF8 \xB7 \uC6D0\uCC9C \uC2E0\uC6D0\uACFC \uC804\uCCB4 \uC774\uB825 \uC644\uC804\uC131\uC740 \uBCC4\uB3C4 \uD655\uC778 \uB300\uC0C1");
    add(section, "p", "\uAD50\uC0AC \uBCF4\uACE0\uC640 \uC800\uC7A5 \uADFC\uAC70\uB97C \uBC18\uC601\uD55C \uD604\uC7AC \uC694\uC57D\uC785\uB2C8\uB2E4. \uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uC870\uD68C\xB7\uC601\uAD6C \uC790\uB3D9 \uB3D9\uAE30\uD654\uB294 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    if (data.summaryCoverage) add(section, "p", `\uD604\uC7AC \uACFC\uC81C ${data.summaryCoverage.shownAssignmentCount}/${data.summaryCoverage.assignmentCount} \xB7 \uB2E8\uACC4 ${data.summaryCoverage.shownChecklistCount}/${data.summaryCoverage.checklistCount} \xB7 \uC6D0\uBB38 ${data.summaryCoverage.rawRecordCount}\uAC74 \xB7 \uC6D0\uCC9C \uC804\uCCB4 \uC774\uB825 \uC644\uC804\uC131 \uBBF8\uD655\uC778${data.summaryCoverage.completeWithinParsedScope ? "" : " \xB7 \uC694\uC57D \uC0C1\uD55C\uC73C\uB85C \uC77C\uBD80\uB9CC \uD45C\uC2DC, \uC6D0\uBB38 \uAE30\uB85D API\uC5D0\uC11C \uC774\uC5B4\uC11C \uD655\uC778"}`);
    const assurance = (ids) => (ids ?? []).some((id) => data.sourceEvidence.some((e) => e.eventId === id && e.provenance?.kind === "user_report_relay")) ? " \xB7 \uC0AC\uC6A9\uC790 \uBCF4\uACE0 / \uB3C5\uB9BD \uC6D0\uBB38 \uBBF8\uAC80\uC99D" : "";
    const prefix = (r) => selectedStudentId ? "" : string(r.displayName) + " \xB7 ";
    const assignments = doc.createElement("div");
    assignments.className = "student-current-assignments";
    add(assignments, "h3", "\uC219\uC81C\uC640 \uAE30\uD55C");
    if (!data.assignments.length) add(assignments, "p", "\uC0C8\uB85C \uBCF4\uC874\uB41C \uC219\uC81C \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC219\uC81C\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.");
    for (const a of data.assignments) {
      const due = a.dueState === "conflicted" ? "\uAE30\uD55C \uADFC\uAC70 \uC0C1\uCDA9" : a.effectiveDue?.date ?? "\uAE30\uD55C \uBBF8\uD655\uC815";
      const row = add(assignments, "p", prefix(a) + string(a.label) + " \xB7 " + assignmentLabels[a.assignmentStatus] + " \xB7 " + due + " \xB7 \uC218\uD589 \uBBF8\uD655\uC778" + assurance(a.evidenceEventIds));
      row.dataset.assignmentId = a.assignmentId;
    }
    section.append(assignments);
    const stages2 = doc.createElement("details");
    stages2.open = true;
    add(stages2, "summary", "\uB2E8\uACC4\uBCC4 \uD604\uC7AC \uC0C1\uD0DC");
    for (const row of data.checklist) {
      const p = add(stages2, "p", prefix(row) + string(row.labelRaw) + " \xB7 " + stateLabels[row.state] + (row.ownerRaw ? " \xB7 \uB2F4\uB2F9 " + string(row.ownerRaw) : "") + (row.conditionRaw ? " \xB7 " + string(row.conditionRaw) : "") + assurance(row.evidenceEventIds));
      p.dataset.stage = row.stage;
      p.dataset.stageState = row.state;
    }
    section.append(stages2);
    if (data.workflowCoverage?.length) {
      const coverage = doc.createElement("details");
      add(coverage, "summary", "\uC804\uCCB4 \uD750\uB984 \uB204\uB77D \uC810\uAC80");
      add(coverage, "p", "\uBC30\uC815\uB41C \uACFC\uC81C\uC758 \uD655\uC778 \uD2C0\uC785\uB2C8\uB2E4. \uC801\uC6A9 \uC5EC\uBD80 \uBBF8\uD655\uC778\uC740 \uBBF8\uC219\uC81C \uD310\uC815\uC774 \uC544\uB2C8\uBA70, \uC55E \uB2E8\uACC4\uAC00 \uBBF8\uD655\uC778\uC774\uC5B4\uB3C4 \uB2E4\uC74C \uD65C\uB3D9\uC744 \uCC28\uB2E8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      for (const a of data.workflowCoverage) {
        add(coverage, "h4", string(a.label));
        for (const c of a.checkpoints) {
          const applicability = { required: "\uD574\uB2F9 \uB2E8\uACC4", waived: "\uC815\uCC45\uC0C1 \uBA74\uC81C", deferred: "\uC0AC\uC720 \uC788\uB294 \uBCF4\uB958", unknown: "\uC801\uC6A9 \uC5EC\uBD80 \uBBF8\uD655\uC778" }[c.applicability];
          add(coverage, "p", string(c.label) + " \xB7 " + applicability + " \xB7 " + (c.state === "not_started" ? "\uBBF8\uC2E4\uC2DC \uADFC\uAC70 \uC788\uC74C" : stateLabels[c.state]) + " \xB7 " + string(c.reason));
        }
      }
      section.append(coverage);
    }
    if (data.schedules.length) {
      const schedules = doc.createElement("details");
      schedules.open = true;
      add(schedules, "summary", "\uC608\uC815 \uCD9C\uACB0\xB7\uBCF4\uAC15");
      for (const row of data.schedules) {
        const e = row.claims[0];
        add(schedules, "p", prefix(row) + string(row.label) + " \xB7 " + e.date + " " + (e.startsLocal ?? "") + (e.endsLocal ? "~" + e.endsLocal : "") + (e.approximate ? "\uACBD" : "") + " \xB7 " + (row.status === "conflicted" ? "\uC77C\uC815 \uADFC\uAC70 \uC0C1\uCDA9" : "\uC608\uC815, \uC2E4\uC81C \uCD9C\uACB0 \uBBF8\uD655\uC778") + assurance(row.evidenceEventIds));
      }
      section.append(schedules);
    }
    if (data.attendance.length) {
      const actual = doc.createElement("div");
      add(actual, "h3", "\uC2E4\uC81C \uB4F1\uC6D0 \uBCF4\uACE0");
      for (const row of data.attendance) {
        const e = row.claims[0];
        add(actual, "p", prefix(row) + e.date + " " + e.session + "\uBD80 \xB7 " + e.arrivalLocal + " \uB4F1\uC6D0 \uBCF4\uACE0 \xB7 \uC815\uAE30 \uC694\uC77C \uBCC0\uACBD \uC544\uB2D8");
      }
      section.append(actual);
    }
    if (data.dateCohorts.length) {
      const cohorts = doc.createElement("div");
      add(cohorts, "h3", "\uB0A0\uC9DC\uBCC4 \uC218\uC5C5 \uB300\uC0C1\uACFC \uC2E4\uC81C \uCC38\uC11D");
      for (const c of data.dateCohorts) {
        add(cohorts, "p", c.date + " " + c.session + "\uBD80: " + c.members.map((m) => string(m.displayName) + " (" + (m.actualAttendanceState === "arrived_user_report" ? m.actualArrival + " \uC2E4\uC81C \uB4F1\uC6D0 \uBCF4\uACE0" : m.actualAttendanceState === "conflicted" ? "\uCD9C\uACB0 \uADFC\uAC70 \uC0C1\uCDA9" : "\uC218\uC5C5 \uB300\uC0C1\xB7\uCD9C\uC11D \uBBF8\uD655\uC778") + ")").join(" \xB7 "));
      }
      section.append(cohorts);
    }
    const source = doc.createElement("details");
    add(source, "summary", "\uADFC\uAC70\uC640 \uBCF4\uC874 \uBC94\uC704");
    add(source, "p", "\uAD50\uC0AC \uBCF4\uACE0: " + (data.sourceFreshness?.latestSourceReportedAt ?? "\uBBF8\uD655\uC778") + " \xB7 \uAD00\uCE21: " + (data.sourceFreshness?.latestSourceObservedAt ?? "\uBBF8\uD655\uC778"));
    add(source, "p", "\uC6D0\uBB38 \uC774\uB825\uC740 \uBCF4\uC874\uD558\uBA70 \uBA85\uC2DC\uC801 \uC815\uC815\uB9CC \uD604\uC7AC \uC0C1\uD0DC\uC5D0 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uAE30\uB85D \uC218\uC9D1\xB7\uC778\uC1C4\xB7\uBC30\uBD80\xB7\uD480\uC774\xB7\uC11C\uBC84 \uC785\uB825\xB7\uAD50\uC0AC \uAC80\uD1A0\uB294 \uBCC4\uAC1C\uC785\uB2C8\uB2E4.");
    const relayed = data.sourceEvidence.filter((e) => e.provenance?.kind === "user_report_relay");
    if (relayed.length) add(source, "p", "\uC0AC\uC6A9\uC790 \uBCF4\uACE0 " + relayed.length + "\uAC74 \xB7 \uB3C5\uB9BD \uC6D0\uBB38 \uBBF8\uAC80\uC99D \xB7 \uD559\uC6D0 \uC11C\uBC84 \uC9C1\uC811 \uD655\uC778 \uADFC\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
    for (const ref of data.references) {
      const e = ref.claims[0];
      add(source, "p", prefix({ displayName: data.assignments.find((a) => a.studentId === e.studentId)?.displayName ?? "\uD559\uC0DD" }) + "\uCC38\uC870 \uADFC\uAC70: " + string(e.scope.rawDescription));
    }
    if (data.retractedAttendance?.length) add(source, "p", "\uCCA0\uD68C\uB41C \uCD9C\uACB0 \uBCF4\uACE0 " + data.retractedAttendance.length + "\uAC74\uC740 \uD604\uC7AC \uCC38\uC11D\uC790\uC5D0 \uBC18\uC601\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    if (data.unresolvedAttendance?.length) add(source, "p", "\uC815\uADDC \uC77C\uC815\uACFC \uB2E4\uB978 \uB4F1\uC6D0 \uBCF4\uACE0 " + data.unresolvedAttendance.length + "\uAC74\uC740 \uC608\uC678 \uCC38\uC11D \uC5EC\uBD80 \uD655\uC778 \uB300\uAE30\uC785\uB2C8\uB2E4.");
    if (data.retractedEventIds?.length) add(source, "p", "\uCCA0\uD68C \uB300\uC0C1 " + data.retractedEventIds.length + "\uAC74\uC740 \uD604\uC7AC \uC644\uB8CC/\uACFC\uC81C\uC5D0\uC11C \uC81C\uC678\uD588\uC2B5\uB2C8\uB2E4.");
    if (data.supersededEventIds?.length) add(source, "p", "\uB300\uCCB4\uB41C \uACFC\uAC70 \uAE30\uB85D " + data.supersededEventIds.length + "\uAC74\uC740 \uC6D0\uBB38 \uC774\uB825\uC5D0 \uBCF4\uC874\uD569\uB2C8\uB2E4.");
    if (data.conflicts.length) add(source, "p", "\uD655\uC778\uD560 \uC0C1\uCDA9 \uADFC\uAC70 " + data.conflicts.length + "\uAC74");
    section.append(source);
    target.append(section);
    return { dispose() {
      section.remove();
    } };
  }

  // src/shared/date.ts
  function academyDate(now = /* @__PURE__ */ new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }

  // src/client/renderers/today-view.ts
  function reportText(event, studentId, hasLaterPlan) {
    if (!event || event.source !== "user_report" || event.studentId !== studentId || !event.payload || typeof event.payload !== "object") throw Error("invalid_teacher_report");
    const p = event.payload;
    const text2 = (v) => {
      if (typeof v !== "string" || !v.length || v.length > 2e3) throw Error("invalid_report_text");
      return v;
    };
    const count = (v) => {
      if (!Number.isSafeInteger(v) || v < 0 || v > 1e3) throw Error("invalid_report_count");
      return v;
    };
    if (event.kind === "assignment_due_update") {
      if (typeof p.dueDate !== "string" || !/^\d{4}-\d\d-\d\d$/.test(p.dueDate) || !p.makeup || p.makeup.status !== "confirmed_existing_schedule") throw Error("invalid_due_update");
      return "\uC219\uC81C \uAE30\uD55C \uBCC0\uACBD: " + text2(p.dueDate) + " " + text2(p.deadlineContext) + " \xB7 \uBCF4\uAC15 " + text2(p.makeup.start) + "~" + text2(p.makeup.end) + " " + text2(p.makeup.teacher) + " \uC120\uC0DD\uB2D8 \xB7 \uB2E4\uC74C \uC815\uADDC \uCD9C\uC11D " + text2(p.nextRegularAttendanceDate);
    }
    if (event.kind === "care_update") {
      const checklist = event.effectiveChecklist ?? p.checklist;
      if (!Array.isArray(checklist) || checklist.length > 30) throw Error("invalid_checklist");
      const labels = { pending: "\uC644\uB8CC \uBBF8\uD655\uC778", reported_missing: "\uBBF8\uC644\uB8CC \uC0AC\uC6A9\uC790 \uD655\uC778", assigned: "\uC219\uC81C \uBC30\uC815", planned: "\uC608\uC815", completed_user_report: "\uC0AC\uC6A9\uC790 \uC644\uB8CC \uD655\uC778" };
      return checklist.map((c) => {
        if (!c || !Object.hasOwn(labels, c.status) || typeof c.dueDate !== "string" || !/^\d{4}-\d\d-\d\d$/.test(c.dueDate) || c.completedAt !== null || c.evidence !== "user_report") throw Error("invalid_checklist_item");
        return text2(c.label) + " [" + labels[c.status] + "] \xB7 " + c.dueDate + " \xB7 " + text2(c.detail);
      }).join("\n");
    }
    if (event.kind === "class_activity") {
      if (p.status !== "in_progress" || p.distribution !== "planned") throw Error("invalid_activity_state");
      return (hasLaterPlan ? "\uC774\uC804 \uAD50\uC0AC \uBCF4\uACE0: " : "\uAD50\uC0AC \uBCF4\uACE0: ") + text2(p.activity) + " \uC9C4\uD589 \uC911 \xB7 " + (hasLaterPlan ? "\uC885\uB8CC \uC5EC\uBD80 \uBBF8\uD655\uC778" : text2(p.afterwards) + " \uC608\uC815");
    }
    if (event.kind === "instruction_update") {
      if (p.planStatus !== "planned" || p.gradingCompletedAt !== null || p.clinicDistribution !== "deferred_after_textbook_work" || !Array.isArray(p.pages) || p.pages.length !== 2 || !p.pages.every((x) => Number.isSafeInteger(x) && x > 0 && x < 1e4) || !Array.isArray(p.priorityPlan) || p.priorityPlan.length < 1 || p.priorityPlan.length > 5) throw Error("invalid_instruction_plan");
      return "\uCD5C\uC2E0 \uAD50\uC0AC \uACC4\uD68D: " + text2(p.bookRaw) + " p." + p.pages.join("~") + " " + text2(p.sectionRaw) + " \xB7 " + p.priorityPlan.map(text2).join(" \u2192 ") + " \uC6B0\uC120 \xB7 \uD074\uB9AC\uB2C9 \uBC30\uBD80 \uD6C4\uC21C\uC704 \xB7 \uC644\uB8CC \uBBF8\uD655\uC778";
    }
    if (event.kind === "printing") {
      if (p.distribution !== "planned") throw Error("invalid_print_plan");
      return "\uAD50\uC0AC \uBCF4\uACE0: \uD504\uB9B0\uD2B8 \uD5E4\uB354 " + count(p.printedHeaderCount) + "\uAC74 \uC778\uC1C4 \xB7 \uB2F9\uC2DC \uBC30\uBD80 \uC608\uC815";
    }
    if (event.kind === "video_plan") {
      if (p.status !== "planned" || p.filmedAt !== null || p.uploadedAt !== null) throw Error("invalid_video_plan");
      return "\uAD50\uC0AC \uBCF4\uACE0: \uBBF8\uC5C5\uB85C\uB4DC \uC601\uC0C1 " + count(p.missingUploadCount) + "\uAC1C \xB7 " + text2(p.plan);
    }
    return "";
  }
  function mountTodayPreparation(target, onUnauthorized) {
    const document2 = target.ownerDocument, section = document2.createElement("section");
    section.className = "today-preparation";
    section.setAttribute("aria-label", "\uC624\uB298 \uC218\uC5C5 \uC900\uBE44");
    const title = document2.createElement("h2");
    title.textContent = "\uC624\uB298 \uC218\uC5C5 \uC900\uBE44";
    const date = document2.createElement("p");
    date.className = "today-date";
    date.textContent = academyDate() + " \xB7 \uD55C\uAD6D \uC2DC\uAC04";
    const status2 = document2.createElement("p");
    status2.setAttribute("role", "status");
    status2.textContent = "\uC624\uB298 \uD559\uC6D0 \uC790\uB8CC \uBBF8\uC870\uD68C \xB7 \uD655\uC778\uB41C \uC624\uB298 \uD560 \uC77C \uC218\uB294 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4.";
    const sessions = document2.createElement("div");
    sessions.className = "today-sessions";
    for (const label2 of ["1\uBD80", "2\uBD80"]) {
      const row = document2.createElement("p");
      row.textContent = label2 + " \xB7 \uD559\uC0DD \uBC30\uC815\xB7\uC219\uC81C\xB7\uAC80\uD1A0 \uBC94\uC704 \uBBF8\uD655\uC778";
      sessions.append(row);
    }
    const button = document2.createElement("button");
    button.type = "button";
    button.textContent = "\uC624\uB298 \uC900\uBE44 \uC694\uC57D \uD655\uC778";
    button.setAttribute("data-today-summary", "");
    const note = document2.createElement("p");
    note.className = "today-note";
    note.textContent = "\uC800\uC7A5\uC790\uB8CC\uC5D0\uC11C \uD655\uC778 \uAC00\uB2A5\uD55C \uBC94\uC704\uB97C \uBD05\uB2C8\uB2E4. \uBE48 \uBAA9\uB85D\uC740 \uD560 \uC77C\uC774 \uC5C6\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD559\uC0DD\uBCC4 \uACFC\uAC70 \uADFC\uAC70\uB294 \uC544\uB798 \uB808\uC77C\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.";
    const detail = document2.createElement("p");
    detail.className = "today-note";
    detail.textContent = "\uACFC\uAC70: \uC800\uC7A5 \uADFC\uAC70 \xB7 \uBBF8\uD655\uC778: \uC624\uB298 DailyRecord\uC640 1\xB72\uBD80 \uBC30\uC815 \xB7 \uC0C1\uCDA9: \uC624\uB298 \uC790\uB8CC \uB300\uC870 \uC804";
    section.append(title, date, status2, sessions, button, note, detail);
    target.prepend(section);
    let currentEventHandle = null;
    let active = true, request = null;
    const click = async () => {
      request?.abort();
      request = new AbortController();
      button.disabled = true;
      status2.textContent = "\uBCF4\uD638\uB41C \uC800\uC7A5 \uC694\uC57D\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
      try {
        const response = await fetch("/api/academy/today?date=" + encodeURIComponent(academyDate()) + "&session=all", { method: "GET", credentials: "same-origin", redirect: "error", headers: { Accept: "application/json" }, signal: request.signal });
        if (!active) return;
        if (response.status === 401 || response.status === 403 || response.type === "opaqueredirect" || response.redirected || response.status >= 300 && response.status < 400 || !response.headers.get("content-type")?.includes("application/json")) {
          onUnauthorized();
          return;
        }
        const data = await response.json();
        if (!active) return;
        const result = data.result;
        if (!response.ok || data.status !== "success" || result?.domain !== "academy" || result?.kind !== "daily_preparation" || result?.sourceMode !== "saved_snapshot" || result?.liveRefreshConnected !== false || !["unverified", "preserved_partial_evidence"].includes(result?.current?.state)) throw Error("verified_today_summary_required");
        currentEventHandle?.dispose();
        currentEventHandle = null;
        if (result.studentEventOverlay) currentEventHandle = mountStudentEventView(section, result.studentEventOverlay);
        date.textContent = result.requestedDate + " \xB7 \uD55C\uAD6D \uC2DC\uAC04";
        if (result.current.state === "preserved_partial_evidence") {
          const tasks = result.current.tasks;
          if (result.requestedDate !== academyDate() || !Array.isArray(tasks) || tasks.length !== result.taskCount || !tasks.length || tasks.some((t) => typeof t.studentId !== "string" || typeof t.displayName !== "string" || ![1, 2].includes(t.session) || t.assignment?.dueDate !== result.requestedDate || typeof t.assignment?.text !== "string" || t.completion !== "unknown" || t.teacherDecision !== null || t.bookId !== null || t.sectionId !== null) || result.historyImport?.coverage !== "partial" || result.historyImport?.liveRefreshConnected !== false) throw Error("invalid_preserved_today");
          const reportTexts = new Map(tasks.map((task) => {
            const reports = task.relatedUserReports ?? [];
            if (!Array.isArray(reports) || reports.length > 100) throw Error("invalid_report_list");
            return [task.studentId, reports.map((e) => reportText(e, task.studentId, reports.some((x) => x.kind === "instruction_update"))).filter(Boolean)];
          }));
          sessions.replaceChildren();
          for (const part of [1, 2]) {
            const heading = document2.createElement("h3");
            heading.textContent = part + "\uBD80";
            sessions.append(heading);
            for (const task of tasks.filter((t) => t.session === part)) {
              const row = document2.createElement("p");
              row.textContent = task.displayName + " \xB7 " + task.assignment.text + " \xB7 \uC219\uC81C \uC644\uB8CC/\uAD50\uC0AC \uD655\uC778 \uBBF8\uD655\uC778";
              sessions.append(row);
              for (const text2 of reportTexts.get(task.studentId) ?? []) {
                const item = document2.createElement("p");
                item.className = "today-note";
                item.textContent = text2;
                item.style.whiteSpace = "pre-line";
                sessions.append(item);
              }
            }
          }
          status2.textContent = "\uBCF4\uC874\uB41C \uC624\uB298 \uACFC\uC81C " + tasks.length + "\uAC74 \xB7 \uC2E4\uC2DC\uAC04 \uC7AC\uC870\uD68C \uC544\uB2D8";
          detail.textContent = "\uC870\uD68C \uADFC\uAC70\uC640 \uAD50\uC0AC \uBCF4\uACE0\uB97C \uAD6C\uBD84\uD588\uC2B5\uB2C8\uB2E4. \uAD50\uC7AC\xB7\uC18C\uB2E8\uC6D0 ID \uC5F0\uACB0\uC740 \uD655\uC778 \uC911\uC774\uBA70, \uBC18 \uBC30\uC815\uC740 \uCD9C\uC11D \uD655\uC778\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uCD5C\uC2E0 \uAD00\uCE21: " + (result.historyImport.latestObservedAt ?? "\uBBF8\uD655\uC778");
          return;
        }
        sessions.replaceChildren();
        for (const label2 of ["1\uBD80", "2\uBD80"]) {
          const row = document2.createElement("p");
          row.textContent = label2 + " \xB7 \uD559\uC0DD \uBC30\uC815\xB7\uC219\uC81C\xB7\uAC80\uD1A0 \uBC94\uC704 \uBBF8\uD655\uC778";
          sessions.append(row);
        }
        status2.textContent = "\uC800\uC7A5 \uC694\uC57D \uD655\uC778 \xB7 \uC624\uB298 \uD559\uC6D0 \uC790\uB8CC\uB294 \uC544\uC9C1 \uBBF8\uC870\uD68C\uC785\uB2C8\uB2E4.";
        detail.textContent = "\uD604\uC7AC \uD560 \uC77C: \uBBF8\uD655\uC778 \xB7 \uACFC\uAC70: \uD559\uC0DD\uBCC4 \uC800\uC7A5 \uADFC\uAC70 \xB7 \uBBF8\uD655\uC778: \uC624\uB298 DailyRecord\uC640 \uBC18 \uBC30\uC815 \xB7 \uC0C1\uCDA9: \uC624\uB298 \uC790\uB8CC \uB300\uC870 \uC804";
      } catch (error) {
        if (active && !(error instanceof Error && error.name === "AbortError")) status2.textContent = "\uC800\uC7A5 \uC694\uC57D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC624\uB298 \uC790\uB8CC\uB294 \uBBF8\uD655\uC778 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD569\uB2C8\uB2E4.";
      } finally {
        if (active) button.disabled = false;
      }
    };
    button.addEventListener("click", click);
    return { dispose() {
      active = false;
      currentEventHandle?.dispose();
      request?.abort();
      button.removeEventListener("click", click);
      section.remove();
    } };
  }

  // src/client/renderers/workflow-view.ts
  var domains = { administration: "\uD559\uC6D0 \uC6B4\uC601", middle_school: "\uC911\uB4F1", elementary_school: "\uCD08\uB4F1", teaching_coaching: "\uC218\uC5C5\xB7\uCF54\uCE6D" };
  var knowledge = { user_confirmed: "\uC0AC\uC6A9\uC790 \uD655\uC778", source_described: "\uBB38\uC11C \uAE30\uC900", observed_structure: "\uAD00\uCC30\uB41C \uAD6C\uC870", recommendation: "\uC81C\uC548", unknown: "\uBBF8\uD655\uC778" };
  var lifecycle = { active: "\uD604\uD589 \uAE30\uC900", historical: "\uACFC\uAC70 \uAE30\uC900", superseded: "\uC774\uC804 \uAE30\uC900", expired: "\uB9CC\uB8CC", deferred: "\uBCF4\uB958" };
  var relationLabels = { precedes: "\uC120\uD589 \uC21C\uC11C", depends_on: "\uD544\uC694\uD55C \uC120\uD589 \uAE30\uC900", performed_by_role: "\uB2F4\uB2F9", produces_artifact: "\uACB0\uACFC\uBB3C", reported_to_role: "\uBCF4\uACE0 \uB300\uC0C1", uses_reference: "\uCC38\uC870 \uC790\uB8CC", uses_concept: "\uC5F0\uACB0 \uAC1C\uB150", related_policy: "\uAD00\uB828 \uAE30\uC900" };
  var object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  var hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  var validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + "T00:00:00Z")) && (/* @__PURE__ */ new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) === v;
  var shown = (v) => typeof v === "string" && v ? v : "\uBBF8\uD655\uC778";
  function parseInput(raw2) {
    if (!object(raw2)) throw Error("invalid_work_context_arguments");
    const input = { ...raw2, ...raw2.view === "preparation" && !("session" in raw2) ? { session: "all" } : {} };
    if (input.view === "policy-index") {
      if (Object.keys(input).some((key) => !["view", "domain", "offset", "limit"].includes(key)) || "domain" in input && !Object.hasOwn(domains, input.domain) || "offset" in input && (!Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 1e4) || "limit" in input && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 20)) throw Error("invalid_policy_index_arguments");
    } else if (input.view === "preparation") {
      if (Object.keys(input).some((key) => !["view", "date", "session", "policyIds", "expectedCatalogRevision", "expectedMembershipRevision", "expectedRosterRevision"].includes(key)) || !validDate(input.date) || input.session !== "all" && input.session !== 1 && input.session !== 2 || !Array.isArray(input.policyIds) || input.policyIds.length > 12 || new Set(input.policyIds).size !== input.policyIds.length || input.policyIds.some((id) => typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id) || id.length > 160) || !hash(input.expectedCatalogRevision) || !hash(input.expectedMembershipRevision) || typeof input.expectedRosterRevision !== "string" || !input.expectedRosterRevision || input.expectedRosterRevision.length > 512) throw Error("invalid_preparation_arguments");
    } else throw Error("invalid_work_context_view");
    return input;
  }
  function assertResponse(value, input) {
    if (!object(value) || value.schemaVersion !== "academy.work-context/2.0.0" || value.view !== input.view || !object(value.revisions) || !hash(value.revisions.catalogRevision) || !hash(value.revisions.membershipRevision) || !hash(value.revisions.registrySha256) || typeof value.revisions.rosterRevision !== "string" || !value.revisions.rosterRevision || value.verification?.storageScopeChecked !== true || value.verification?.sourceIdentityIndependentlyVerified !== false || value.verification?.studentRecordsChanged !== false || value.verification?.externalSourceQueried !== false || value.verification?.liveAdapterConnected !== false) throw Error("verified_work_context_required");
    if (input.view === "policy-index") {
      if (!Array.isArray(value.policies) || value.policies.length > (input.limit ?? 12) || !Array.isArray(value.domains) || !object(value.pagination) || value.pagination.offset !== (input.offset ?? 0) || !Number.isSafeInteger(value.pagination.total) || typeof value.pagination.hasMore !== "boolean" || value.policies.some((p) => !object(p) || typeof p.policyId !== "string" || typeof p.labelRaw !== "string" || !Object.hasOwn(domains, p.domain) || input.domain !== void 0 && p.domain !== input.domain)) throw Error("invalid_policy_index_scope");
    } else {
      const p = value.preparation;
      if (value.revisions.catalogRevision !== input.expectedCatalogRevision || value.revisions.membershipRevision !== input.expectedMembershipRevision || value.revisions.rosterRevision !== input.expectedRosterRevision || !object(p) || p.kind !== "workflow_preparation_reference" || p.requestedDate !== input.date || p.timezone !== "Asia/Seoul" || p.actionBoundary?.externalSourceQueried !== false || p.actionBoundary?.studentRecordsChanged !== false || p.studentWork?.taskCount !== null || p.studentWork?.emptyMeansNoTasks !== false || p.studentWork?.assignments?.state !== "not_loaded" || p.studentWork?.executionAttempts?.state !== "not_loaded" || p.dateCohorts?.classDate !== input.date || p.dateCohorts?.timezone !== "Asia/Seoul" || p.dateCohorts?.source?.sha256 !== input.expectedMembershipRevision || p.dateCohorts?.rosterRevision?.rosterRevision !== input.expectedRosterRevision || p.dateCohorts?.coverage?.attendanceInferred !== false || p.dateCohorts?.coverage?.liveLmsQueryPerformed !== false || !Array.isArray(p.dateCohorts?.cohorts) || !Array.isArray(p.dateCohorts?.unverified) || !Array.isArray(p.workflowTemplate?.nodes) || !Array.isArray(p.workflowTemplate?.relations) || !Array.isArray(p.workflowTemplate?.sources) || p.workflowTemplate?.meaning !== "selected_policy_reference_not_student_tasks" || p.workflowTemplate?.revision !== input.expectedCatalogRevision || input.policyIds.length === 0 && (p.workflowTemplate.nodes.length !== 0 || p.workflowTemplate.relations.length !== 0 || p.workflowTemplate.sources.length !== 0) || input.policyIds.some((id) => !p.workflowTemplate.nodes.some((n) => n.kind === "policy" && n.id === id))) throw Error("invalid_preparation_scope");
      for (const cohort of p.dateCohorts.cohorts) {
        if (cohort.classDate !== input.date || !Array.isArray(cohort.members) || input.session !== "all" && cohort.sessionSlot?.ordinal !== input.session || cohort.attendanceState !== "not_assessed" || cohort.taskCount !== null || cohort.emptyMeansNoClass !== false || cohort.members.some((m) => typeof m.studentId !== "string" || typeof m.displayName !== "string" || m.liveVerified !== false || m.effectiveFrom === null && input.date < m.confirmedAsOf)) throw Error("invalid_date_cohort_scope");
      }
    }
  }
  function mountWorkflowView(target, options) {
    const document2 = target.ownerDocument;
    const make = (tag, className = "", text2) => {
      const el2 = document2.createElement(tag);
      if (className) el2.className = className;
      if (text2 !== void 0) el2.textContent = text2;
      return el2;
    };
    const section = make("section", "workflow-view");
    section.setAttribute("aria-label", "\uC624\uB298 \uC218\uC5C5\uACFC \uC5C5\uBB34 \uD750\uB984");
    section.dataset.workflowView = "";
    const header = make("div", "workflow-heading"), title = make("h2", "", "\uC624\uB298 \uC218\uC5C5\uACFC \uC5C5\uBB34 \uD750\uB984"), sourceBadge = make("span", "workflow-source-badge", "\uC800\uC7A5 \uADFC\uAC70 \xB7 \uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uBBF8\uC5F0\uACB0");
    header.append(title, sourceBadge);
    const controls = make("div", "workflow-controls");
    const dateLabel = make("label", "", "\uB0A0\uC9DC"), date = make("input");
    date.type = "date";
    date.value = academyDate(options.now?.() ?? /* @__PURE__ */ new Date());
    date.setAttribute("data-workflow-date", "");
    dateLabel.append(date);
    const sessionLabel = make("label", "", "\uC218\uC5C5"), session = make("select");
    session.setAttribute("data-workflow-session", "");
    for (const [value, label2] of [["all", "\uC804\uCCB4"], ["1", "1\uBD80"], ["2", "2\uBD80"]]) {
      const opt = make("option", "", label2);
      opt.value = value;
      session.append(opt);
    }
    sessionLabel.append(session);
    const reload = make("button", "workflow-reload", "\uB2E4\uC2DC \uD655\uC778");
    reload.type = "button";
    reload.dataset.workflowReload = "";
    controls.append(dateLabel, sessionLabel, reload, make("span", "workflow-timezone", "\uD55C\uAD6D \uC2DC\uAC04"));
    const status2 = make("p", "workflow-status", "\uBCF4\uD638\uB41C \uC218\uC5C5 \uBC30\uC815 \uADFC\uAC70\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
    status2.setAttribute("role", "status");
    status2.setAttribute("aria-live", "polite");
    const cohorts = make("div", "workflow-cohorts");
    const note = make("p", "workflow-note", "\uD655\uC778\uB41C \uC694\uC77C\xB7\uC218\uC5C5 \uBC30\uC815\uC73C\uB85C \uBB36\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uCD9C\uC11D\xB7\uC219\uC81C\xB7\uC644\uB8CC \uC0C1\uD0DC\uB294 \uBCC4\uB3C4 \uADFC\uAC70\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
    const details = make("details", "workflow-details"), summary = make("summary", "", "\uC5C5\uBB34 \uAE30\uC900 \uCC3E\uC544\uBCF4\uAE30");
    const workspace = make("div", "workflow-workspace"), policyNav = make("div", "workflow-policy-nav");
    const domainLabel = make("label", "", "\uC5C5\uBB34 \uC601\uC5ED"), domain2 = make("select");
    domain2.dataset.workflowDomain = "";
    const all = make("option", "", "\uBAA8\uB4E0 \uC601\uC5ED");
    all.value = "";
    domain2.append(all);
    for (const [value, label2] of Object.entries(domains)) {
      const opt = make("option", "", label2);
      opt.value = value;
      domain2.append(opt);
    }
    domainLabel.append(domain2);
    const policyList = make("div", "workflow-policy-list");
    policyList.setAttribute("aria-label", "\uC5C5\uBB34 \uAE30\uC900 \uC120\uD0DD");
    const pages = make("div", "workflow-pages"), previous = make("button", "", "\uC774\uC804"), next = make("button", "", "\uB2E4\uC74C"), pageLabel = make("span");
    previous.type = next.type = "button";
    previous.dataset.workflowPrevious = "";
    next.dataset.workflowNext = "";
    pages.append(previous, pageLabel, next);
    policyNav.append(domainLabel, policyList, pages);
    const policyDetail = make("div", "workflow-policy-detail");
    policyDetail.append(make("p", "workflow-note", "\uAE30\uC900\uC744 \uC120\uD0DD\uD558\uBA74 \uACC4\uCE35, \uBA85\uC2DC\uB41C \uC120\uD589 \uC870\uAC74, \uADFC\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
    workspace.append(policyNav, policyDetail);
    details.append(summary, make("p", "workflow-note", "\uC5C5\uBB34 \uAE30\uC900\uC740 \uC808\uCC28 \uCC38\uACE0\uC6A9\uC785\uB2C8\uB2E4. \uC120\uD0DD\uD55C \uD559\uC0DD\uC5D0\uAC8C \uC0DD\uAE34 \uC624\uB298\uC758 \uBBF8\uC644\uB8CC \uC5C5\uBB34\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."), workspace);
    const provenance = make("details", "workflow-provenance");
    provenance.append(make("summary", "", "\uBC30\uC815 \uADFC\uAC70\uC640 \uD655\uC778 \uBC94\uC704"));
    section.append(header, controls, status2, cohorts, note, details, provenance);
    target.prepend(section);
    let active = true, epoch = 0, request = null, index = null, prepared = null, selectedPolicyIds = [], selectedNodeId = null, lastError = null;
    const lifecycleController = new AbortController();
    const isCurrent = (token) => active && epoch === token;
    const ensureCurrent = (token) => {
      if (!isCurrent(token)) throw Error("superseded_work_context");
    };
    function setBusy(busy) {
      section.setAttribute("aria-busy", String(busy));
      reload.disabled = busy;
    }
    function showError(error) {
      if (!active) return;
      lastError = error instanceof Error ? error.message : "work_context_failed";
      status2.textContent = prepared ? "\uC5C5\uBB34 \uAE30\uC900 \uBAA9\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB9C8\uC9C0\uB9C9 \uD655\uC778\uB41C \uBC30\uC815 \uADFC\uAC70\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4." : "\uC218\uC5C5\xB7\uC5C5\uBB34 \uADFC\uAC70\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB0A0\uC9DC\uBCC4 \uBC30\uC815\uACFC \uC2E4\uC81C \uD560 \uC77C\uC740 \uBBF8\uD655\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.";
      status2.dataset.state = "error";
      if (!prepared) policyDetail.replaceChildren(make("p", "workflow-note", "\uAC80\uC99D\uB41C \uC5C5\uBB34 \uAE30\uC900\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."));
    }
    function clearReadView() {
      prepared = null;
      cohorts.replaceChildren();
      policyDetail.replaceChildren(make("p", "workflow-note", "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC640 \uC5C5\uBB34 \uAE30\uC900\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
      provenance.replaceChildren(make("summary", "", "\uBC30\uC815 \uADFC\uAC70\uC640 \uD655\uC778 \uBC94\uC704"));
    }
    function buildPreparationArgs() {
      if (!index) throw Error("work_context_index_required");
      return parseInput({ view: "preparation", date: date.value, session: session.value === "all" ? "all" : Number(session.value), policyIds: selectedPolicyIds, ...{ expectedCatalogRevision: index.revisions.catalogRevision, expectedMembershipRevision: index.revisions.membershipRevision, expectedRosterRevision: index.revisions.rosterRevision } });
    }
    function indexArgs(offset = 0) {
      return parseInput({ view: "policy-index", limit: 8, offset, ...domain2.value ? { domain: domain2.value } : {} });
    }
    async function fetchResult(input, token, signal) {
      const response = await fetch("/api/academy/work-context?input=" + encodeURIComponent(JSON.stringify(input)), { method: "GET", credentials: "same-origin", redirect: "error", headers: { Accept: "application/json" }, signal });
      ensureCurrent(token);
      const mediaType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (response.status === 401 || response.status === 403 || response.type === "opaqueredirect" || response.redirected || response.status >= 300 && response.status < 400 || !(mediaType === "application/json" || mediaType?.endsWith("+json"))) {
        options.onUnauthorized();
        throw Error("protected_identity_response_required");
      }
      const envelope = await response.json();
      ensureCurrent(token);
      if (!response.ok || !object(envelope) || envelope.status !== "success") throw Error(object(envelope) && typeof envelope.status === "string" ? envelope.status : "work_context_read_failed");
      assertResponse(envelope.result, input);
      return envelope.result;
    }
    function renderIndex(result) {
      index = result;
      policyList.replaceChildren();
      for (const policy of result.policies) {
        const button = make("button", "workflow-policy", "");
        button.type = "button";
        button.dataset.workflowPolicy = policy.policyId;
        button.setAttribute("aria-pressed", String(selectedPolicyIds.includes(policy.policyId)));
        button.append(make("span", "", policy.labelRaw), make("small", "", `${domains[policy.domain]} \xB7 ${lifecycle[policy.lifecycle] ?? policy.lifecycle}`));
        button.addEventListener("click", () => {
          selectedPolicyIds = [policy.policyId];
          selectedNodeId = policy.policyId;
          details.open = true;
          void refreshPreparation().catch(() => {
          });
        });
        policyList.append(button);
      }
      if (result.policies.length === 0) policyList.append(make("p", "workflow-note", "\uC774 \uBC94\uC704\uC5D0 \uD45C\uC2DC\uD560 \uC5C5\uBB34 \uAE30\uC900\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."));
      const start = result.pagination.total === 0 ? 0 : result.pagination.offset + 1, end = result.pagination.offset + result.policies.length;
      pageLabel.textContent = `${start}\u2013${end} / ${result.pagination.total}`;
      previous.disabled = result.pagination.offset === 0;
      next.disabled = !result.pagination.hasMore;
    }
    function renderCohorts(p) {
      cohorts.replaceChildren();
      for (const cohort of p.dateCohorts.cohorts) {
        const row = make("div", "workflow-cohort");
        row.append(make("h3", "", cohort.sessionSlot.ordinal + "\uBD80"));
        const people = make("div", "workflow-people");
        for (const member of cohort.members) {
          const button = make("button", "workflow-student", member.displayName);
          button.type = "button";
          button.dataset.workflowStudent = member.studentId;
          button.disabled = !options.canSelectStudent(member.studentId);
          button.title = button.disabled ? "\uD604\uC7AC \uD5C8\uC6A9\uB41C \uD559\uC0DD \uBC94\uC704\uC640 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." : "\uD559\uC0DD\uC758 \uC800\uC7A5 \uD559\uC2B5 \uADFC\uAC70 \uC5F4\uAE30";
          button.addEventListener("click", async () => {
            if (!active || !options.canSelectStudent(member.studentId)) return;
            button.disabled = true;
            try {
              await options.selectStudent(member.studentId);
              if (active) {
                const rail = document2.querySelector("#c2-root");
                rail?.scrollIntoView?.({ behavior: "smooth", block: "start" });
              }
            } catch {
              if (active) {
                status2.textContent = "\uD559\uC0DD \uC800\uC7A5 \uADFC\uAC70\uB97C \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC120\uD0DD\uACFC \uC790\uB8CC\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4.";
              }
            } finally {
              if (active) button.disabled = !options.canSelectStudent(member.studentId);
            }
          });
          people.append(button);
        }
        if (!cohort.members.length) people.append(make("p", "workflow-note", p.dateCohorts.unverified.some((u) => u.reason === "historical_start_unknown") ? "\uB4F1\uB85D \uC2DC\uC791\uC77C \uBBF8\uD655\uC778 \xB7 \uC774 \uB0A0\uC9DC\uC758 \uBC30\uC815\uC740 \uD310\uB2E8\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uC774 \uB0A0\uC9DC\uC5D0 \uC801\uC6A9 \uAC00\uB2A5\uD55C \uBC30\uC815 \uADFC\uAC70\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uC5C5\uC774 \uC5C6\uB2E4\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4."));
        row.append(people);
        const projected = cohort.members.some((m) => m.applicability === "projected_pattern_not_date_verified");
        row.append(make("p", "workflow-cohort-note", projected ? "\uD655\uC778\uB41C \uC694\uC77C \uD328\uD134\uC758 \uC608\uC0C1 \uBC30\uC815 \xB7 \uD574\uB2F9 \uB0A0\uC9DC \uC2E4\uC81C \uD3B8\uC131 \uBBF8\uD655\uC778" : cohort.members.length ? "\uC0AC\uC6A9\uC790 \uD655\uC778 \uAE30\uC900 \xB7 \uCD9C\uC11D \uBBF8\uD655\uC778" : "\uBC30\uC815 \uBBF8\uD655\uC778 \xB7 \uCD9C\uC11D \uBBF8\uD655\uC778"));
        cohorts.append(row);
      }
      provenance.replaceChildren(make("summary", "", "\uBC30\uC815 \uADFC\uAC70\uC640 \uD655\uC778 \uBC94\uC704"));
      provenance.append(make("p", "", `\uC0AC\uC6A9\uC790 \uD655\uC778 \uAE30\uC900\uC77C: ${shown(p.dateCohorts.source.confirmedAsOf)} \xB7 \uD655\uC778 \uB0B4\uC6A9 \uC218\uC2E0 \uC2DC\uAC01: ${shown(p.dateCohorts.source.receivedAt)}`), make("p", "", "\uB4F1\uB85D \uC2DC\uC791\xB7\uC885\uB8CC\uAC00 \uBBF8\uD655\uC778\uC778 \uD559\uC0DD\uC740 \uD655\uC778\uC77C \uC774\uC804 \uB0A0\uC9DC\uC5D0 \uC18C\uAE09 \uBC30\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774\uD6C4 \uB0A0\uC9DC\uB294 \uD655\uC778\uB41C \uC694\uC77C \uD328\uD134\uC758 \uC608\uC0C1 \uBC30\uC815\uC785\uB2C8\uB2E4."), make("p", "", "\uC870\uD68C \uBC94\uC704: \uBA85\uC2DC\uC801\uC73C\uB85C \uD655\uC778\uD55C \uD559\uC0DD\uB9CC \xB7 \uD559\uC6D0 \uC804\uCCB4 \uBA85\uB2E8 \uC544\uB2D8 \xB7 \uD734\uC6D0\xB7\uBCF4\uAC15\xB7\uBC18 \uBCC0\uACBD \uBBF8\uB300\uC870"), make("p", "", "\uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uC870\uD68C: \uD558\uC9C0 \uC54A\uC74C \xB7 \uB0A0\uC9DC\uBCC4 \uACFC\uC81C\xB7\uC2E4\uD589\xB7\uD604\uC7AC \uD310\uC815: \uBD88\uB7EC\uC624\uC9C0 \uC54A\uC74C"));
      for (const cohort of p.dateCohorts.cohorts) for (const m of cohort.members) provenance.append(make("p", "", `${m.displayName}: ${m.enrollmentWeekdayPattern.label} \xB7 ${m.sessionSlot.ordinal}\uBD80 \xB7 \uB4F1\uB85D \uC2DC\uC791 ${shown(m.effectiveFrom)} / \uC885\uB8CC ${shown(m.effectiveTo)}`));
      if (p.dateCohorts.unverified.length) provenance.append(make("p", "", `\uC120\uD0DD \uB0A0\uC9DC\uC5D0 \uC801\uC6A9 \uC5EC\uBD80 \uBBF8\uD655\uC778: ${p.dateCohorts.unverified.length}\uBA85. \uC774\uB984\uC744 \uACFC\uAC70 \uBC18 \uBA85\uB2E8\uC73C\uB85C \uC81C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`));
    }
    function renderSourceList(anchors, all2) {
      const list = make("div", "workflow-sources");
      for (const source of anchors) {
        const entry = make("details", "workflow-source"), label2 = source.kind === "user_statement" ? "\uC0AC\uC6A9\uC790 \uD655\uC778" : source.kind === "assistant_inference" ? "\uCD94\uB860" : source.kind === "ui_structure" ? "\uAD00\uCC30\uB41C \uAD6C\uC870" : "\uBB38\uC11C \uADFC\uAC70";
        entry.append(make("summary", "", `${label2} \xB7 ${source.sourceAlias}`), make("p", "", source.assertionRaw), make("p", "workflow-note", `\uC6D0\uBB38 \uB0A0\uC9DC ${shown(source.dateRaw)} \xB7 \uC804\uB2EC ${shown(source.reportedAt)} \xB7 \uAD00\uCC30 ${shown(source.observedAt)} \xB7 \uC800\uC7A5 ${shown(source.capturedAt)}`));
        if (source.supersedesAnchorIds.length) {
          entry.append(make("p", "workflow-note", "\uC218\uC815\uD55C \uC774\uC804 \uADFC\uAC70:"));
          for (const id of source.supersedesAnchorIds) {
            const older = all2.find((s) => s.id === id);
            entry.append(make("p", "workflow-note", older ? `${older.sourceAlias}: ${older.assertionRaw}` : `\uC774\uC804 \uADFC\uAC70 ID: ${id}`));
          }
        }
        entry.append(make("p", "workflow-note", "\uC774 \uADFC\uAC70\uB294 \uC2E4\uC2DC\uAC04 \uD559\uC0DD \uC870\uD68C\uB098 \uC2E4\uD589 \uC644\uB8CC\uB97C \uC99D\uBA85\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        list.append(entry);
      }
      if (!anchors.length) list.append(make("p", "workflow-note", "\uC774 \uB178\uB4DC\uC5D0 \uC9C1\uC811 \uC5F0\uACB0\uB41C \uADFC\uAC70\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."));
      return list;
    }
    function renderTemplate(p) {
      policyDetail.replaceChildren();
      const template = p.workflowTemplate, nodes = template.nodes, byId = new Map(nodes.map((node) => [String(node.id), node]));
      if (!selectedPolicyIds.length) {
        policyDetail.append(make("p", "workflow-note", "\uAE30\uC900\uC744 \uC120\uD0DD\uD558\uBA74 \uACC4\uCE35, \uBA85\uC2DC\uB41C \uC120\uD589 \uC870\uAC74, \uADFC\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
        return;
      }
      const chosen = nodes.find((node) => node.kind === "policy" && selectedPolicyIds.includes(node.id));
      if (!chosen) {
        policyDetail.append(make("p", "workflow-note", "\uC120\uD0DD\uD55C \uAE30\uC900\uC758 \uAC80\uC99D\uB41C \uB0B4\uC6A9\uC744 \uD45C\uC2DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."));
        return;
      }
      policyDetail.append(make("h3", "", chosen.labelRaw), make("p", "workflow-policy-meta", `${knowledge[chosen.knowledge] ?? chosen.knowledge} \xB7 ${lifecycle[chosen.lifecycle] ?? chosen.lifecycle} \xB7 \uC808\uCC28 \uCC38\uACE0\uC6A9`));
      const policySource = p.sourceCoverage?.find((source) => source.sourceKind === "operating_policy_checkpoint");
      if (policySource) policyDetail.append(make("p", "workflow-note", `\uC6B4\uC601 \uAE30\uC900 \uC800\uC7A5\uBCF8\uC758 \uAE30\uC900\uC77C: ${shown(policySource.sourceAsOf)} \xB7 \uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uC870\uD68C \uC790\uB8CC \uC544\uB2D8`));
      const tree = make("div", "workflow-tree");
      tree.setAttribute("aria-label", "\uC5C5\uBB34 \uAE30\uC900 \uACC4\uCE35");
      const contains = template.relations.filter((edge) => edge.kind === "contains"), hierarchyKinds = ["academy_root", "domain", "policy", "step"];
      const displayNodes = nodes.filter((n) => hierarchyKinds.includes(n.kind)), parents = new Set(contains.map((e) => String(e.to)));
      const rootNodes = displayNodes.filter((node) => !parents.has(node.id));
      const addBranch = (node, seen) => {
        const item = make("li"), button = make("button", "workflow-node");
        button.type = "button";
        button.dataset.workflowNode = node.id;
        button.setAttribute("aria-pressed", String((selectedNodeId ?? chosen.id) === node.id));
        button.textContent = node.kind === "domain" ? domains[node.domain] : node.kind === "academy_root" ? "\uD559\uC6D0 \uC5C5\uBB34 \uAE30\uC900" : node.labelRaw;
        if (node.kind === "step") button.append(make("small", "", "\uC808\uCC28 \uD45C\uC2DC \uC21C\uC11C " + (node.order + 1)));
        button.addEventListener("click", () => {
          selectedNodeId = node.id;
          renderTemplate(p);
          Array.from(policyDetail.querySelectorAll("[data-workflow-node]")).find((button2) => button2.dataset.workflowNode === node.id)?.focus();
        });
        item.append(button);
        const nextSeen = new Set(seen).add(node.id), children = contains.filter((e) => e.from === node.id).sort((a, b) => (a.kind === "contains" ? a.order : 0) - (b.kind === "contains" ? b.order : 0)).flatMap((e) => {
          const child = byId.get(e.to);
          return child && hierarchyKinds.includes(child.kind) && !nextSeen.has(child.id) ? [child] : [];
        });
        if (children.length) {
          const childList = make("ul");
          children.forEach((child) => childList.append(addBranch(child, nextSeen)));
          item.append(childList);
        }
        return item;
      };
      const branches = make("ul");
      rootNodes.forEach((node) => branches.append(addBranch(node, /* @__PURE__ */ new Set())));
      tree.append(branches);
      policyDetail.append(tree);
      const selected2 = byId.get(selectedNodeId ?? chosen.id) ?? chosen;
      const focused = make("section", "workflow-node-detail");
      focused.append(make("h4", "", selected2.labelRaw));
      if (selected2.kind === "policy") {
        const values = [["\uC801\uC6A9", selected2.applicability.activationRaw], ["\uC8FC\uAE30", selected2.cadenceRaw], ["\uAE30\uD55C", selected2.deadlineRaw], ["\uBC94\uC704", selected2.scopeRaw], ["\uB2F4\uB2F9", selected2.responsibilityRaw]];
        const dl2 = make("dl");
        for (const [term, value] of values) {
          dl2.append(make("dt", "", term), make("dd", "", value));
        }
        focused.append(dl2);
        if (selected2.preconditions.length) {
          focused.append(make("h5", "", "\uC801\uC6A9 \uC804 \uD655\uC778"));
          const list = make("ul");
          for (const condition of selected2.preconditions) list.append(make("li", "", condition.labelRaw + " \xB7 " + { required: "\uD544\uC694", unconfirmed: "\uBBF8\uD655\uC778", not_applicable: "\uD574\uB2F9 \uC5C6\uC74C" }[condition.state]));
          focused.append(list);
        }
        if (selected2.exceptions.length) {
          const exception = make("details");
          exception.append(make("summary", "", "\uC608\uC678\uC640 \uC801\uC6A9 \uBC94\uC704"));
          selected2.exceptions.forEach((text2) => exception.append(make("p", "", text2)));
          focused.append(exception);
        }
      }
      const edges = template.relations.filter((edge) => edge.kind !== "contains" && (edge.from === selected2.id || edge.to === selected2.id));
      focused.append(make("h5", "", "\uBA85\uC2DC\uB41C \uC5F0\uACB0"));
      if (edges.length) {
        const list = make("ul", "workflow-relations");
        for (const edge of edges) {
          const from = byId.get(edge.from), to = byId.get(edge.to);
          let text2 = edge.kind === "depends_on" ? `${to?.labelRaw ?? edge.to} \u2192 ${from?.labelRaw ?? edge.from}` : `${from?.labelRaw ?? edge.from} \u2192 ${to?.labelRaw ?? edge.to}`;
          list.append(make("li", "", `${relationLabels[edge.kind] ?? edge.kind}: ${text2}`));
        }
        focused.append(list);
      } else focused.append(make("p", "workflow-note", "\uC774 \uB178\uB4DC\uC5D0 \uBA85\uC2DC\uB41C \uC120\uD589\xB7\uCC38\uC870 \uC5F0\uACB0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uD45C\uC2DC \uC21C\uC11C\uB9CC\uC73C\uB85C \uC120\uD589 \uC870\uAC74\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
      const allPrerequisites = template.relations.filter((edge) => edge.kind === "precedes" || edge.kind === "depends_on");
      if (allPrerequisites.length) {
        const prerequisite = make("details");
        prerequisite.append(make("summary", "", "\uC120\uD0DD \uBC94\uC704 \uC804\uCCB4\uC758 \uBA85\uC2DC\uB41C \uC120\uD589 \uC870\uAC74"));
        for (const edge of allPrerequisites) {
          const from = byId.get(edge.from), to = byId.get(edge.to);
          prerequisite.append(make("p", "", edge.kind === "depends_on" ? `${to?.labelRaw ?? edge.to} \u2192 ${from?.labelRaw ?? edge.from}` : `${from?.labelRaw ?? edge.from} \u2192 ${to?.labelRaw ?? edge.to}`));
        }
        focused.append(prerequisite);
      }
      focused.append(make("h5", "", "\uC2E4\uD589\xB7\uC7AC\uC2DC\uB3C4"), make("p", "workflow-note", "\uD559\uC0DD\uBCC4 \uC2E4\uD589 \uC2DC\uB3C4\xB7\uC7AC\uC2DC\uB3C4\xB7\uC7AC\uAC1C \uAE30\uB85D\uC740 \uBD88\uB7EC\uC624\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC774 \uACC4\uCE35\uACFC \uC120\uD589 \uC870\uAC74\uC73C\uB85C \uC644\uB8CC \uC5EC\uBD80\uB97C \uD310\uB2E8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
      const sources = make("details", "workflow-source-details");
      sources.append(make("summary", "", `\uC120\uD0DD\uD55C \uD56D\uBAA9\uC758 \uADFC\uAC70 ${selected2.sourceAnchorIds.length}\uAC1C`), renderSourceList(template.sources.filter((source) => selected2.sourceAnchorIds.includes(source.id)), template.sources));
      focused.append(sources);
      policyDetail.append(focused);
    }
    function accept(result, input) {
      lastError = null;
      if (result.view === "policy-index") {
        renderIndex(result);
        if (input.view === "policy-index") domain2.value = input.domain ?? "";
        status2.textContent = prepared ? `${prepared.preparation.requestedDate} \xB7 \uBC30\uC815 \uADFC\uAC70 \uD655\uC778. \uC5C5\uBB34 \uAE30\uC900\uC740 \uBCC4\uB3C4\uB85C \uC120\uD0DD\uD558\uC138\uC694.` : "\uC5C5\uBB34 \uAE30\uC900 \uBAA9\uB85D \uD655\uC778 \xB7 \uB0A0\uC9DC\uBCC4 \uBC30\uC815 \uADFC\uAC70\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.";
      } else if (input.view === "preparation") {
        date.value = input.date;
        const value = String(input.session);
        if (!Array.from(session.options).some((option) => option.value === value)) {
          const option = make("option", "", value + "\uBD80");
          option.value = value;
          session.append(option);
        }
        session.value = value;
        selectedPolicyIds = [...input.policyIds];
        prepared = result;
        renderCohorts(result.preparation);
        renderTemplate(result.preparation);
        if (index) renderIndex(index);
        status2.textContent = `${result.preparation.requestedDate} \xB7 \uD655\uC778\uB41C \uBC30\uC815 \uADFC\uAC70 \uAE30\uC900. \uC2E4\uC81C \uCD9C\uC11D\xB7\uACFC\uC81C\xB7\uC644\uB8CC\uB294 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4.`;
        status2.dataset.state = "ready";
        if (input.policyIds.length) details.open = true;
      }
    }
    async function execute(raw2) {
      const input = parseInput(raw2);
      if (!active) throw Error("work_context_disposed");
      const token = ++epoch;
      request?.abort();
      request = new AbortController();
      setBusy(true);
      status2.textContent = "\uBCF4\uD638\uB41C \uC800\uC7A5 \uADFC\uAC70\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
      if (input.view === "preparation") clearReadView();
      try {
        const result = await fetchResult(input, token, request.signal);
        ensureCurrent(token);
        accept(result, input);
        return result;
      } catch (error) {
        if (isCurrent(token) && !(error instanceof Error && error.name === "AbortError")) showError(error);
        throw error;
      } finally {
        if (isCurrent(token)) setBusy(false);
      }
    }
    async function refreshPreparation() {
      return execute(buildPreparationArgs());
    }
    async function initialize() {
      try {
        const result = await execute(indexArgs());
        if (!active || result.view !== "policy-index") return;
        await refreshPreparation();
      } catch {
      }
    }
    const refresh = () => {
      if (!validDate(date.value)) {
        epoch++;
        request?.abort();
        setBusy(false);
        clearReadView();
        status2.textContent = "\uD655\uC778\uD560 \uB0A0\uC9DC\uB97C \uC62C\uBC14\uB974\uAC8C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.";
        return;
      }
      void (index ? refreshPreparation() : initialize()).catch(() => {
      });
    };
    date.addEventListener("change", refresh);
    session.addEventListener("change", refresh);
    reload.addEventListener("click", refresh);
    domain2.addEventListener("change", () => {
      void execute(indexArgs()).catch(() => {
      });
    });
    previous.addEventListener("click", () => {
      void execute(indexArgs(Math.max(0, (index?.pagination.offset ?? 0) - (index?.pagination.limit ?? 8)))).catch(() => {
      });
    });
    next.addEventListener("click", () => {
      void execute(indexArgs((index?.pagination.offset ?? 0) + (index?.pagination.limit ?? 8))).catch(() => {
      });
    });
    const ready = initialize();
    function dispose2() {
      if (!active) return;
      active = false;
      epoch++;
      request?.abort();
      request = null;
      lifecycleController.abort();
      index = null;
      prepared = null;
      selectedPolicyIds = [];
      selectedNodeId = null;
      section.replaceChildren();
      section.remove();
      document2.defaultView?.removeEventListener("pagehide", dispose2);
    }
    document2.defaultView?.addEventListener("pagehide", dispose2, { once: true });
    return { element: section, ready, execute, attach(nextTarget) {
      if (active) nextTarget.prepend(section);
    }, getState() {
      return { active, date: date.value, session: session.value, selectedPolicyIds: [...selectedPolicyIds], hasPreparation: prepared !== null, lastError };
    }, dispose: dispose2 };
  }

  // src/client/renderers/evidence-view.ts
  function mountEvidenceView(p, target, receipt) {
    if (!p || !Array.isArray(p.evidenceRecords) || !Array.isArray(p.decisionRecords) || p.namespaceBinding?.studentId !== p.studentId || p.externalSourceQueried !== false || p.lastSuccessfulRefreshedAt !== null) throw Error("validated_evidence_projection_required");
    const doc = target.ownerDocument, books = target.querySelector("#c2-books");
    if (!books) throw Error("evidence_source_renderer_missing");
    const owned = /* @__PURE__ */ new Set(), evidence = new Map(p.evidenceRecords.map((e) => [e.evidenceId, e])), decisions = new Map(p.decisionRecords.map((d) => [d.decisionId, d]));
    let disposed = false, pending = false;
    const make = (tag, cls, text2) => {
      const n = doc.createElement(tag);
      n.className = cls;
      if (text2 !== void 0) n.textContent = text2;
      return n;
    };
    const own = (n, kind) => {
      n.setAttribute("data-domain-evidence-owned", kind);
      owned.add(n);
      return n;
    };
    const label2 = { user_report: "\uC0AC\uC6A9\uC790 \uBCF4\uACE0", imported_snapshot: "\uD559\uC6D0 \uC790\uB8CC \uC800\uC7A5\uBCF8", inference: "\uADFC\uAC70\uB85C \uACC4\uC0B0\uD55C \uCD94\uB860", lms_direct_observation: "\uD559\uC6D0 \uC9C1\uC811 \uC870\uD68C" };
    const verification = { unverified: "\uB3C5\uB9BD \uAC80\uC99D \uC804", corroborated: "\uB2E4\uB978 \uADFC\uAC70\uB85C \uB300\uC870\uB428", contradicted: "\uADFC\uAC70 \uCDA9\uB3CC \xB7 \uC815\uC815 \uAC80\uD1A0" };
    function evidenceNode(e) {
      const row = make("article", "domain-evidence-record");
      row.setAttribute("data-domain-evidence-id", e.evidenceId);
      row.setAttribute("data-source-kind", e.sourceKind);
      row.setAttribute("data-verification-status", e.verificationStatus);
      const value = e.claim.value, type = e.claim.type;
      let description = type;
      if (type === "not_observed_within_recent3w_capture") description = `\uC5C5\uB85C\uB4DC \uCEA1\uCC98\uC5D0\uC11C ${value.targetLabel} \uBBF8\uAD00\uCC30 \xB7 \uCD5C\uADFC3\uC8FC/27\uD589 \uBC94\uC704\uB9CC \xB7 \uC2E4\uC81C \uC11C\uBC84 \uAC31\uC2E0 \uC544\uB2D8`;
      else if (type.includes("grading_observation")) description = `\uC800\uC7A5 \uC571 \uC810\uC218 ${value.score}\uC810 \xB7 \uC6D0\uBCF8 \uD45C\uC2DC ${value.eventTimeRaw ?? "\uBBF8\uC81C\uACF5"}`;
      else if (type === "teacher_review_statement") description = `\uAD50\uC0AC \uD310\uB2E8 ${value.path === "original_wrong" ? "\uC6D0\uC624\uB2F5" : "\uC720\uC0AC\uD074\uB9AC\uB2C9"} \xB7 ${value.state === "teacher_confirmed_complete" ? "\uC644\uB8CC" : value.state}`;
      else if (type === "print_confirmation") description = "\uAD50\uC0AC \uC778\uC1C4 \uBCF4\uACE0 \xB7 \uC778\uC1C4 \uC644\uB8CC \xB7 \uD5E4\uB354\xB7\uC7A5\uC218\xB7\uBC30\uBD80\xB7\uC218\uB839 \uBBF8\uD655\uC778";
      else if (type === "grading_registration_user_report") description = "\uC571 \uB4F1\uB85D \uC0C1\uD0DC \uC0AC\uC6A9\uC790 \uBCF4\uACE0 \xB7 \uBBF8\uB4F1\uB85D\uC774\uB77C\uACE0 \uBCF4\uACE0\uB428 \xB7 \uCD5C\uC885 \uC81C\uCD9C \uD310\uB2E8 \uB300\uAE30";
      else if (type === "user_defined_submission_acceptance_rule") description = "\uC0AC\uC6A9\uC790\uAC00 \uC815\uD55C \uC81C\uCD9C \uD655\uC778 \uAE30\uC900";
      else if (type === "teacher_new_homework_assignment_instruction") description = "\uC0C8 \uC219\uC81C \uBC94\uC704 \uAD50\uC0AC \uC9C0\uC2DC";
      else if (type === "cached_native_catalog_structure") description = "\uD559\uC6D0 \uBAA9\uB85D \uAD6C\uC870 \uC800\uC7A5 \uADFC\uAC70";
      else if (type === "final_lesson_embedded_written_response_rule") description = "\uB9C8\uC9C0\uB9C9 \uCC28\uC2DC\uC5D0 \uC11C\uC220\uD615\uC774 \uD3EC\uD568\uB41C\uB2E4\uB294 \uC0AC\uC6A9\uC790 \uBCF4\uACE0";
      else if (type === "assignment_catalog_unit_count") description = "\uC800\uC7A5\uB41C \uBAA9\uB85D\uC73C\uB85C \uACC4\uC0B0\uD55C \uC571 \uCC44\uC810 \uB2E8\uC704 \uC218";
      row.append(make("p", "domain-evidence-claim", `${label2[e.sourceKind] ?? e.sourceKind} \xB7 ${description}`));
      if (type === "not_observed_within_recent3w_capture") row.append(make("p", "domain-evidence-meta", "\uAD00\uCC30/\uCEA1\uCC98 \uC2DC\uAC01\uC740 \uC5C5\uB85C\uB4DC HAR\uC758 \uAD6C\uC870 \uC2DC\uAC01\uC774\uBA70 \uD559\uC0DD \uC218\uD589 \uC0AC\uAC74 \uC2DC\uAC01\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB3C5\uB9BD \uC778\uC99D\uC740 \uBBF8\uAC80\uC99D\uC774\uACE0 \uD559\uC2B5 \uC0AC\uAC74 \uC2DC\uAC01\xB7\uD559\uC6D0 \uAC31\uC2E0 \uC131\uACF5 \uC2DC\uAC01\uC744 \uC0DD\uC131\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
      row.append(make("p", "domain-evidence-meta", `${verification[e.verificationStatus]} \xB7 \uAD00\uCC30 \uC2DC\uAC01 ${e.observedAt ?? "\uBBF8\uC81C\uACF5"} \xB7 \uBCF4\uACE0 \uC2DC\uAC01 ${e.reportedAt ?? "\uBBF8\uC81C\uACF5"} \xB7 \uAE30\uB85D \uC2DC\uAC01 ${e.recordedAt}`));
      if (e.timeRaw) row.append(make("p", "domain-evidence-meta", `\uC2DC\uAC01 \uC6D0\uBB38 ${e.timeRaw} \xB7 \uC5F0\uB3C4\xB7\uC2DC\uAC04\uB300\xB7\uC815\uD655\uD55C \uC0AC\uAC74 \uC2DC\uAC01\uC744 \uC790\uB3D9 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`));
      const correction = e.supersedesEvidenceIds.length || e.retractsEvidenceIds.length || e.conflictingEvidenceIds.length;
      row.append(make("p", "domain-evidence-meta", correction ? "\uC815\uC815\xB7\uCCA0\uD68C\xB7\uCDA9\uB3CC \uCC38\uC870\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uD310\uC815\uC744 \uB2E4\uC2DC \uAC80\uD1A0\uD574\uC57C \uD569\uB2C8\uB2E4." : "\uC815\uC815 \uB300\uAE30: \uD604\uC7AC \uC5F0\uACB0\uB41C \uC815\uC815\xB7\uCCA0\uD68C\xB7\uCDA9\uB3CC \uADFC\uAC70 \uC5C6\uC74C"));
      const detail = make("details", "domain-evidence-source"), summary2 = make("summary", "", "\uCD9C\uCC98\uC640 \uC815\uD655\uD55C \uBC94\uC704");
      detail.append(summary2, make("p", "domain-evidence-meta", `\uADFC\uAC70 ${e.evidenceId} \xB7 source ${e.sourceRef.reference ?? e.sourceRef.sourceMessageId ?? "\uBBF8\uC81C\uACF5"} \xB7 \uC6D0\uBB38 \uC704\uCE58 ${e.sourceRef.jsonPointer ?? "\uBBF8\uC81C\uACF5"} \xB7 revision ${e.revision}`));
      row.append(detail);
      return row;
    }
    function decisionNode(d) {
      const n = make("p", "domain-decision");
      n.setAttribute("data-domain-decision-id", d.decisionId);
      n.setAttribute("data-decision-status", d.decisionStatus);
      n.textContent = `\uD310\uC815 \uAE30\uB85D \uC8FC\uCCB4 ${d.decisionAuthority.role} \xB7 ${d.decisionStatus === "pending" ? "\uD310\uC815 \uB300\uAE30" : d.decisionStatus === "confirmed" ? "\uAD50\uC0AC \uACB0\uC815 \uD655\uC815" : d.decisionStatus} \xB7 \uC0AC\uC2E4\uC758 \uB3C5\uB9BD \uAC80\uC99D\uC740 \uAC01 \uADFC\uAC70 \uC0C1\uD0DC\uB97C \uB530\uB985\uB2C8\uB2E4. \xB7 \uADDC\uCE59 ${d.ruleVersion}`;
      return n;
    }
    const summary = own(make("section", "domain-evidence-summary"), "summary");
    summary.setAttribute("aria-label", "\uADFC\uAC70 \uC885\uB958\uC640 \uD655\uC778 \uC0C1\uD0DC");
    summary.setAttribute("data-domain-student-id", p.studentId);
    summary.append(make("h2", "domain-evidence-title", "\uAD00\uCC30\xB7\uBCF4\uACE0\xB7\uD310\uC815\uC758 \uCD9C\uCC98"), make("p", "domain-evidence-meta", `\uC800\uC7A5 \uAD00\uCC30 ${p.evidenceRecords.filter((e) => e.sourceKind === "imported_snapshot" && e.claim.type.includes("grading_observation")).length}\uAC74 \xB7 \uC0AC\uC6A9\uC790 \uBCF4\uACE0 ${p.evidenceRecords.filter((e) => e.sourceKind === "user_report").length}\uAC74 \xB7 \uD310\uC815 \uB300\uAE30 ${p.decisionRecords.filter((d) => d.decisionStatus === "pending").length}\uAC74 \xB7 \uC774\uBC88 \uD559\uC6D0 \uC9C1\uC811 \uC870\uD68C 0\uAC74`), make("p", "domain-evidence-meta", "\uC0AC\uC6A9\uC790\uAC00 \uB9D0\uD588\uC74C\uC744 \uD655\uC778\uD55C \uADFC\uAC70\uB3C4 \uC0AC\uC2E4\uC758 \uB3C5\uB9BD \uAC80\uC99D \uC0C1\uD0DC\uB294 \uB530\uB85C \uC720\uC9C0\uD569\uB2C8\uB2E4. \uBCF4\uACE0 \uC2DC\uAC01\uC740 \uC2E4\uC81C \uAD00\uCC30 \uC2DC\uAC01\uC774\uB098 \uD559\uC6D0 \uAC31\uC2E0 \uC131\uACF5 \uC2DC\uAC01\uC744 \uB300\uC2E0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
    const reports = p.evidenceRecords.filter((e) => ["grading_registration_user_report", "not_observed_within_recent3w_capture"].includes(e.claim.type));
    if (reports.length) {
      const box = make("details", "domain-report-list");
      box.append(make("summary", "", `\uD604\uC7AC \uC0AC\uC6A9\uC790 \uC870\uD68C \uBCF4\uACE0 ${reports.length}\uAC74 \xB7 \uCD5C\uC885 \uD310\uC815 \uB300\uAE30`));
      for (const e of reports) box.append(evidenceNode(e));
      for (const d of p.decisionRecords.filter((d2) => d2.decisionStatus === "pending")) box.append(decisionNode(d));
      summary.append(box);
    }
    for (const a of p.assignments) {
      const section = make("details", "domain-assignment");
      section.setAttribute("data-domain-assignment-id", a.assignmentId);
      section.append(make("summary", "", `${a.nativeBookTitleRaw} \xB7 \uC0C8 \uC219\uC81C ${a.appGradingUnitCount}\uAC1C \uC571 \uCC44\uC810 \uB2E8\uC704`), make("p", "domain-evidence-meta", `\uAD50\uC0AC \uBC30\uC815 \uC9C0\uC2DC \xB7 \uC218\uD589 \uBBF8\uD655\uC778 \xB7 \uC644\uB8CC \uBBF8\uD655\uC778 \xB7 \uB9C8\uAC10 \uBBF8\uC9C0\uC815 \xB7 \uB2E4\uC74C \uCD9C\uC11D ${a.tentativeNextAttendanceDate ?? "\uBBF8\uC81C\uACF5"} \uC7A0\uC815 (\uB9C8\uAC10 \uC544\uB2D8) \xB7 \uC2E4\uC81C \uD559\uC6D0 \uC11C\uBC84 \uBC30\uC815 \uBBF8\uD655\uC778`));
      const list = make("ol", "domain-assignment-items");
      for (const item of a.scopeItems) {
        const li = make("li", "");
        li.setAttribute("data-domain-assignment-record", item.existingRecordRef);
        li.textContent = `${item.nativeGroupingLabel} ${item.nativeTitleRaw} \xB7 ${item.nativeSectionLabelRaw} ${item.lessonIndex ? item.lessonIndex + "\uCC28\uC2DC" : ""} \xB7 ${item.catalogCode} \xB7 \uC218\uD589 \uBBF8\uD655\uC778`;
        for (const c of item.embeddedContents) li.append(make("p", "domain-evidence-meta", `${c.sourceLabelRaw} \uD3EC\uD568 \xB7 \uC0AC\uC6A9\uC790 \uBCF4\uACE0 \uADDC\uCE59 \xB7 \uBCC4\uB3C4 \uCC44\uC810 \uB2E8\uC704 \uC5C6\uC74C \xB7 \uC11C\uBC84 \uD3EC\uD568 \uAD00\uACC4 \uC9C1\uC811\uAC80\uC99D \uC804`));
        list.append(li);
      }
      section.append(list);
      summary.append(section);
    }
    const binding = make("details", "domain-namespace");
    binding.append(make("summary", "", "\uD559\uC0DD ID\uC640 \uC790\uB8CC \uC5F0\uACB0 \uD655\uC778"), make("p", "domain-evidence-meta", `\uC800\uC7A5 \uD559\uC0DD ${p.studentId} \xB7 \uC6D0\uBCF8 \uC790\uB8CC SHA ${p.sourceSnapshotSha256} \xB7 \uD559\uC6D0 native \uD559\uC0DD ID \uBBF8\uD655\uC778 \xB7 \uC774\uB984\uB9CC\uC73C\uB85C \uC790\uB8CC\uB97C \uD569\uCE58\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`));
    summary.append(binding);
    books.before(summary);
    function refresh() {
      if (disposed) return;
      for (const n of owned) if (!target.contains(n)) owned.delete(n);
      for (const row of target.querySelectorAll("[data-record-container]")) {
        const rid = row.dataset.recordContainer, body = row.querySelector(".inline-evidence");
        if (!body || !body.children.length || body.querySelector('[data-domain-evidence-owned="detail"]')) continue;
        const es = (p.recordEvidenceIds[rid] ?? []).map((id) => evidence.get(id)), ds = (p.recordDecisionIds[rid] ?? []).map((id) => decisions.get(id));
        if (!es.length && !ds.length) continue;
        const section = own(make("section", "domain-evidence-detail"), "detail");
        section.append(make("h6", "domain-evidence-title", "\uC774 \uD589\uC758 \uCD9C\uCC98\xB7\uC2DC\uAC01\xB7\uAC80\uC99D \uC0C1\uD0DC"));
        for (const e of es) section.append(evidenceNode(e));
        for (const d of ds) section.append(decisionNode(d));
        body.append(section);
      }
    }
    function schedule() {
      if (disposed || pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (!disposed) refresh();
      });
    }
    const delegated = (event) => {
      if (event.target?.closest?.("[data-record-id],[data-close-record]")) schedule();
    };
    target.addEventListener("click", delegated);
    target.addEventListener("keydown", delegated);
    const Observer = doc.defaultView?.MutationObserver, observer = Observer ? new Observer((ms) => {
      if (ms.some((m) => m.target.nodeType === 1 && m.target.matches(".inline-evidence") && [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType !== 1 || !n.hasAttribute("data-domain-evidence-owned")))) schedule();
    }) : null;
    refresh();
    observer?.observe(target, { childList: true, subtree: true });
    return { refresh, dispose() {
      disposed = true;
      observer?.disconnect();
      target.removeEventListener("click", delegated);
      target.removeEventListener("keydown", delegated);
      for (const n of owned) n.remove();
      owned.clear();
    } };
  }

  // src/client/renderers/assessment-view.ts
  function mountAssessmentView(p, target, receipt) {
    if (p.coverage.state !== "not_collected" || p.coverage.actualAttemptCount !== 0 || p.assessmentAttempts.length || receipt?.studentId !== p.studentId || receipt?.localReadModelValidated !== true) throw Error("validated_empty_assessment_projection_required");
    const doc = target.ownerDocument, books = target.querySelector("#c2-books");
    if (!books) throw Error("assessment_source_renderer_missing");
    const section = doc.createElement("section");
    section.className = "assessment-view";
    section.setAttribute("data-assessment-student-id", p.studentId);
    section.setAttribute("data-assessment-projection-sha", receipt.assessmentProjectionSha256);
    section.setAttribute("data-assessment-contract-sha", receipt.contractSha256);
    const text2 = (tag, value, cls = "") => {
      const n = doc.createElement(tag);
      n.className = cls;
      n.textContent = value;
      return n;
    };
    section.append(text2("h2", "\uC2DC\uD5D8 \uAE30\uB85D: \uC544\uC9C1 \uC6D0\uBCF8 \uC5F0\uACB0 \uC548 \uB428"), text2("p", "\uB3C5\uB9BD DT/ZT \uC2DC\uD5D8 \uC751\uC2DC \uC6D0\uBCF8 \uC218\uC9D1 0\uAC74 \xB7 \uCC44\uC810 \uC790\uB8CC not_collected \xB7 \uC2E4\uC81C \uBBF8\uC751\uC2DC\uB098 \uBBF8\uC644\uB8CC\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "assessment-meta"), text2("p", "\uC77C\uC9C0\uC758 DT \uC5B8\uAE09\uC740 \uC77C\uC9C0 \uADFC\uAC70\uB85C\uB9CC \uC77D\uC2B5\uB2C8\uB2E4. DT\uB294 DailyTest \uC18C\uB2E8\uC6D0 \uC218\uC5C5 cycle\uC774\uACE0 Daily Restudy\uB294 \uAD50\uC7AC \uC139\uC158\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uC815\uC815\uC5D0 \uB530\uB77C \uC11C\uB85C \uB2E4\uB978 \uD56D\uBAA9\uC774\uBA70 \uBCC4\uCE6D\xB7\uB3D9\uC77C binding\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2DC\uD5D8 \uD68C\uCC28\xB7\uD310\uBCF8\xB7\uBB38\uD56D\xB7\uC810\uC218\xB7\uAD50\uC0AC \uC644\uB8CC\uB294 \uC6D0\uBCF8 \uC5F0\uACB0 \uC804\uC785\uB2C8\uB2E4.", "assessment-meta"));
    const coverage = p.diaryCoverage, details = doc.createElement("details");
    details.className = "assessment-diary-evidence";
    details.append(text2("summary", `\uC77C\uC9C0 \uADFC\uAC70 ${coverage.projectedDiaryCount}\uAC74 \xB7 DT \uC5B8\uAE09 ${coverage.dtMentionCount}\uAC74 \xB7 \uC6D0\uBCF8 \uC5F0\uACB0 \uBC94\uC704 \uD655\uC778`));
    details.append(text2("p", coverage.state === "not_collected" ? "\uC774 \uD559\uC0DD\uC758 canonical \uC77C\uC9C0 namespace\uB97C \uC544\uC9C1 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC77C\uC9C0\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4." : `\uC81C\uACF5\uB41C canonical \uC77C\uC9C0 ${coverage.sourceDiaryCount}\uAC74 \uC911 ${coverage.projectedDiaryCount}\uAC74 \uD45C\uC2DC \xB7 \uC9C4\uD589\uC694\uC57D ${coverage.nonEmptyProgressCount}\uAC74 / \uBE48 \uC6D0\uBB38 ${coverage.emptyProgressCount}\uAC74 \xB7 \uC804\uCCB4 \uD559\uC0DD \uC774\uB825 \uC644\uC804\uC131 \uBBF8\uD655\uC778`, "assessment-meta"));
    for (const row of p.diaryEvidence) {
      const c = row.evidence.claim.value, article = doc.createElement("article");
      article.setAttribute("data-diary-source-id", row.sourceDiaryId);
      article.setAttribute("data-diary-projection-state", row.priorProjectionState);
      article.append(text2("h3", `${c.dateRaw} \xB7 \uC800\uC7A5 \uC77C\uC9C0${row.mentionsDT ? " \xB7 DT \uC5B8\uAE09" : ""}`));
      article.append(text2("p", c.progressSummary || "\uC9C4\uD589\uC694\uC57D\uC774 \uBE48 \uC6D0\uBB38\uC785\uB2C8\uB2E4. \uC218\uD589 \uD310\uB2E8\uC5D0 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."));
      if (c.homeworkSummary) article.append(text2("p", "\uB2F9\uC2DC \uC219\uC81C \uC6D0\uBB38: " + c.homeworkSummary));
      const state = row.priorProjectionState === "recovered_omission" ? "\uC774\uC804 \uD654\uBA74\uC5D0\uC11C \uBE60\uC9C4 \uC6D0\uBB38\uC744 \uBCF5\uAD6C\uD588\uC2B5\uB2C8\uB2E4." : row.priorProjectionState === "preserved_unbound" ? "\uD2B9\uC815 \uAD50\uC7AC\xB7\uC2DC\uD5D8 \uC751\uC2DC\uC640\uC758 \uC5F0\uACB0\uC774 \uBBF8\uD655\uC778\uC778 \uC6D0\uBB38\uC744 \uBCF4\uC874\uD569\uB2C8\uB2E4." : row.priorProjectionState === "source_empty_progress" ? "\uBE48 \uC6D0\uBB38\uB3C4 coverage\uC5D0 \uD3EC\uD568\uD569\uB2C8\uB2E4." : "\uAE30\uC874 \uC77C\uBD80 \uC778\uC6A9\uACFC \uBCC4\uB3C4\uB85C \uC6D0\uC77C\uC9C0 \uD55C \uD589\uC744 \uBCF4\uC874\uD569\uB2C8\uB2E4.";
      article.append(text2("p", state + " \uC5F0\uB3C4 \uBBF8\uD655\uC778 \xB7 \uC0AC\uAC74/\uAD00\uCC30 \uC2DC\uAC01 \uBBF8\uC81C\uACF5 \xB7 DT=DailyTest \uC218\uC5C5 \uD65C\uB3D9 \xB7 Daily Restudy\uC640 \uBCC4\uB3C4(\uC0AC\uC6A9\uC790 \uC815\uC815), \uD559\uC6D0 UI \uD0C0\uC785 \uB300\uC751 \uBBF8\uAC80\uC99D", "assessment-meta"), text2("p", `sourceKind imported_snapshot \xB7 \uAC80\uC99D \uC0C1\uD0DC \uB3C5\uB9BD \uAC80\uC99D \uC804 \xB7 \uC6D0\uBCF8 ${c.originalSource.fileName} ${c.originalSource.jsonPointer} \xB7 source SHA ${c.originalSource.fileSha256}`, "assessment-meta"));
      details.append(article);
    }
    section.append(details, text2("p", `\uB3C5\uB9BD \uC800\uC7A5\uC18C\uC758 \uD559\uC0DD \uBC94\uC704\xB7\uD45C\uC2DC \uAD6C\uC870 \uD655\uC778 \xB7 \uC6D0\uCC9C \uC751\uC2DC \uC2E0\uC6D0 \uBBF8\uAC80\uC99D \xB7 \uC2E4\uC81C \uD559\uC6D0 \uC870\uD68C \uC5C6\uC74C`, "assessment-meta"));
    books.before(section);
    return { dispose() {
      section.remove();
    } };
  }

  // src/client/renderers/refresh-readiness.ts
  function renderRefreshReadiness(r, target) {
    const doc = target.ownerDocument, section = doc.createElement("section");
    section.className = "refresh-readiness";
    section.setAttribute("data-refresh-student-id", r.studentId);
    const title = doc.createElement("p");
    title.textContent = "\uD559\uC0DD \uC120\uD0DD\uC740 \uC800\uC7A5 \uADFC\uAC70 \uBCF4\uAE30\uC785\uB2C8\uB2E4. \uD559\uC6D0 \uC11C\uBC84 \uC0C8 \uC870\uD68C \uC644\uB8CC\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
    const button = doc.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("data-student-refresh-unavailable", r.studentId);
    button.textContent = "\uC774 \uD559\uC0DD \uD559\uC6D0 \uC815\uBCF4 \uAC31\uC2E0 \xB7 \uD604\uC7AC \uC5F0\uACB0 \uC900\uBE44 \uC911";
    const reason = doc.createElement("p");
    reason.className = "refresh-meta";
    reason.textContent = "\uC2E4\uC81C \uC870\uD68C \uC5F0\uACB0 \uC5C6\uC74C \xB7 backend \uC2DC\uB3C4 0 \xB7 \uB9C8\uC9C0\uB9C9 \uC131\uACF5 \uAC31\uC2E0 \uBBF8\uC81C\uACF5 \xB7 \uD604\uC7AC \uC800\uC7A5 \uC790\uB8CC \uAE30\uC900\uC2DC\uAC01 \uBBF8\uC81C\uACF5";
    const details = doc.createElement("details");
    details.append(Object.assign(doc.createElement("summary"), { textContent: `\uAD00\uB9AC \uC601\uC5ED ${r.areas.length}\uAC1C \xB7 \uC5F0\uACB0 \uB2E8\uACC4\uC640 \uBBF8\uD655\uC778 \uBC94\uC704` }));
    for (const a of r.areas) {
      const p = doc.createElement("p");
      p.className = "refresh-meta";
      p.setAttribute("data-refresh-area-id", a.areaId);
      p.textContent = `${a.label}: ${a.stages.menu_observed ? "\uBA54\uB274 \uAD00\uCC30" : "\uBA54\uB274 \uBBF8\uD655\uC778"} \xB7 ${a.stages.request_captured ? "\uC694\uCCAD \uCEA1\uCC98" : "\uC694\uCCAD \uBBF8\uD655\uC778"} \xB7 ${a.stages.offline_parser_verified ? "\uD569\uC131 parser \uAC80\uC99D" : "parser \uBBF8\uAC80\uC99D"} \xB7 \uC778\uC99D/\uC2E4\uC81C\uC870\uD68C/\uBC18\uC601 \uBBF8\uAC80\uC99D`;
      details.append(p);
    }
    section.append(title, button, reason, details);
    target.append(section);
    return { dispose() {
      section.remove();
    } };
  }

  // src/client/app.ts
  var shell = document.querySelector("#app-shell");
  var root = document.querySelector("#c2-root");
  var extra = document.querySelector("#unresolved");
  var status = document.querySelector("#runtime-status");
  var work = document.querySelector("#work-domains");
  var recordsRoot = document.querySelector("#record-list");
  var selected = null;
  var domain = "assignment";
  var generation = 0;
  var recordGeneration = 0;
  var controller = null;
  var recordController = null;
  var handles = [];
  var roster = [];
  var locked = false;
  var workflow = null;
  var el = (tag, value = "", className = "") => {
    const n = document.createElement(tag);
    n.textContent = value;
    n.className = className;
    return n;
  };
  function dispose() {
    handles.reverse().forEach((h) => h.dispose());
    handles = [];
    root.replaceChildren();
    extra.replaceChildren();
  }
  function clear() {
    locked = true;
    generation++;
    recordGeneration++;
    controller?.abort();
    recordController?.abort();
    workflow?.dispose();
    workflow = null;
    dispose();
    roster = [];
    selected = null;
    recordsRoot.replaceChildren();
    work.replaceChildren();
    shell.replaceChildren(el("p", "\uAD8C\uD55C \uD655\uC778\uC5D0 \uC2E4\uD328\uD574 \uBCF4\uD638\uB41C \uC790\uB8CC\uB97C \uB2EB\uC558\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC778\uC99D\uD55C \uB4A4 \uD654\uBA74\uC744 \uC0C8\uB85C \uC5EC\uC138\uC694."));
    status.textContent = "\uC778\uC99D \uD544\uC694";
  }
  async function read(path, signal) {
    const response = await fetch(path, { method: "GET", credentials: "same-origin", redirect: "error", signal, headers: { Accept: "application/json" } });
    if (response.status === 401 || response.status === 403) {
      clear();
      throw Error("authorization_required");
    }
    if (!response.ok || !response.headers.get("content-type")?.startsWith("application/json")) throw Error("read_failed");
    return response.json();
  }
  async function renderRecords() {
    if (locked) return;
    const n = ++recordGeneration;
    recordController?.abort();
    recordController = new AbortController();
    recordsRoot.setAttribute("aria-busy", "true");
    try {
      const r = await read("/api/records?domain=" + encodeURIComponent(domain) + (selected ? "&studentId=" + encodeURIComponent(selected) : ""), recordController.signal);
      if (n !== recordGeneration || locked) return;
      recordsRoot.replaceChildren(el("h2", "\uC120\uD0DD \uC5C5\uBB34\uC758 \uC800\uC7A5 \uAE30\uB85D"), el("p", r.total ? `\uC800\uC7A5 ${r.total}\uAC74 \xB7 \uC774\uBC88 \uD654\uBA74 ${r.items.length}\uAC74 \xB7 \uC6D0\uCC9C \uC804\uCCB4 \uBC94\uC704 \uC644\uC804\uC131 \uBBF8\uD655\uC778` : "\uC544\uC9C1 \uC774 \uBC94\uC704\uC758 \uC790\uB8CC\uB97C \uAC00\uC838\uC624\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD559\uC0DD\uC758 \uBBF8\uC218\uD589\uC774\uB098 \uC5C5\uBB34 \uC644\uB8CC\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
      for (const item of r.items) {
        const d = el("details");
        d.append(el("summary", item.kind + " \xB7 " + item.id), el("p", `\uADFC\uAC70 ${item.provenance.sourceKind} \xB7 ${item.provenance.verification} \xB7 ${item.provenance.completeness}`), el("pre", JSON.stringify(item, null, 2)));
        recordsRoot.append(d);
      }
      if (r.nextOffset !== null) recordsRoot.append(el("p", "\uB2E4\uC74C \uD398\uC774\uC9C0 \uAE30\uB85D\uC740 \uC77D\uAE30 API\uC758 nextOffset\uC73C\uB85C \uC774\uC5B4\uC9D1\uB2C8\uB2E4."));
    } catch (e) {
      if (e.name !== "AbortError" && !locked && n === recordGeneration) recordsRoot.replaceChildren(el("p", "\uAE30\uB85D\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC644\uB8CC\uB098 \uBD80\uC7AC \uD310\uC815\uC774 \uC544\uB2D9\uB2C8\uB2E4."));
    } finally {
      if (n === recordGeneration) recordsRoot.setAttribute("aria-busy", "false");
    }
  }
  async function selectStudent(id) {
    if (locked || !roster.some((s) => s.id === id)) return;
    const token = ++generation;
    controller?.abort();
    controller = new AbortController();
    shell.setAttribute("aria-busy", "true");
    try {
      const result = await read("/api/students/" + encodeURIComponent(id), controller.signal);
      if (token !== generation || locked) return;
      if (result.student?.id !== id || result.projection && result.projection.studentId !== id || result.verification?.scopeChecked !== true) throw Error("student_scope_mismatch");
      recordGeneration++;
      recordController?.abort();
      recordsRoot.replaceChildren(el("p", "\uC120\uD0DD \uD559\uC0DD\uC758 \uAE30\uB85D\uC744 \uD655\uC778 \uC911\uC785\uB2C8\uB2E4."));
      dispose();
      selected = id;
      const inner = el("div", "", "shell-inner"), nav = el("nav", "", "student-nav");
      nav.setAttribute("aria-label", "\uD559\uC0DD \uC120\uD0DD");
      for (const s of roster) {
        const b = el("button", s.displayName);
        b.type = "button";
        b.dataset.studentId = s.id;
        b.setAttribute("aria-pressed", String(s.id === selected));
        b.addEventListener("click", () => void selectStudent(s.id));
        nav.append(b);
      }
      inner.append(el("div", "\uD559\uC6D0 \uC5C5\uBB34 \xB7 \uB3C5\uB9BD \uC800\uC7A5\uC18C", "app-title"), nav, el("p", result.sourceMode === "synthetic" ? "\uD569\uC131 \uD559\uC0DD \uD654\uBA74 \uAC80\uC218\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uD559\uC0DD \uC790\uB8CC\uB294 \uC544\uC9C1 \uAC00\uC838\uC624\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." : "\uAC00\uC838\uC628 \uC800\uC7A5\uBCF8\uC785\uB2C8\uB2E4. \uC2E4\uC2DC\uAC04 \uD559\uC6D0 \uC7AC\uC870\uD68C \uACB0\uACFC\uAC00 \uC544\uB2D9\uB2C8\uB2E4."));
      shell.replaceChildren(inner);
      const panels = result.panels;
      if (panels?.studentEventOverlay) handles.push(mountStudentEventView(inner, panels.studentEventOverlay, id));
      if (workflow) workflow.attach(inner);
      else workflow = mountWorkflowView(inner, { onUnauthorized: clear, canSelectStudent: (studentId) => roster.some((s) => s.id === studentId), selectStudent });
      const today = el("details", "", "legacy-today-detail"), body = el("div");
      today.append(el("summary", "\uC800\uC7A5 \uACFC\uC81C\xB7\uC624\uB298 \uC900\uBE44 \uD655\uC778"), body);
      inner.append(today);
      handles.push(mountTodayPreparation(body, clear));
      if (panels?.refreshReadiness) handles.push(renderRefreshReadiness(panels.refreshReadiness, inner));
      if (result.projection) {
        const p = result.projection, rails = mountC2ProgressRails(p.view, root);
        handles.push(rails, mountIncludedContents(p, root));
        if (p.teacherOverlay) handles.push(mountTeacherOverlay(p.teacherOverlay, root));
        if (panels?.evidenceProjection) handles.push(mountEvidenceView(panels.evidenceProjection, root));
        if (panels?.assessmentProjection) handles.push(mountAssessmentView(panels.assessmentProjection, root, panels.assessmentReceipt));
        else if (panels?.unprojectedAssessmentCount) root.prepend(el("p", `\uC6D0\uBB38 \uC2DC\uD5D8 \uAE30\uB85D ${panels.unprojectedAssessmentCount}\uAC74\uC740 \uAD6C\uC870 \uB300\uC751\uC774 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4. \uC5C5\uBB34\uBCC4 \uC800\uC7A5 \uAE30\uB85D\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.`));
        handles.push(mountDesktopStepper(shell, root, extra, { studentId: id, studentName: result.student.displayName, sourceRecordPath: "#record-list", view: p.view, teacherOverlay: p.teacherOverlay, selectRecord: (rid) => rails.selectRecord(rid) }));
      } else root.append(el("p", "\uAD50\uC7AC \uD45C\uC2DC \uAD6C\uC870\uAC00 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC6D0\uBB38\uC740 \uC544\uB798 \uC5C5\uBB34\uBCC4 \uC800\uC7A5 \uAE30\uB85D\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4."));
      await renderRecords();
    } catch (e) {
      if (e.name !== "AbortError" && !locked && token === generation) {
        const n = el("p", "\uD559\uC0DD \uC790\uB8CC\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAC80\uC99D\uB41C \uD604\uC7AC \uD45C\uC2DC \uBC94\uC704\uB97C \uD655\uC778\uD558\uC138\uC694.", "load-error");
        n.setAttribute("role", "alert");
        shell.prepend(n);
      }
    } finally {
      if (token === generation) shell.setAttribute("aria-busy", "false");
    }
  }
  function selectDomainButton() {
    work.querySelectorAll("[data-domain]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.domain === domain)));
  }
  async function init() {
    try {
      const [runtime, students, domains2] = await Promise.all([read("/api/status"), read("/api/students"), read("/api/work-domains")]);
      if (locked) return false;
      roster = students.students;
      status.textContent = `\uB3C5\uB9BD Node + SQLite \xB7 ${runtime.synthetic ? "\uD569\uC131 \uC790\uB8CC\uB9CC" : "\uAC1C\uC778 \uC800\uC7A5\uBCF8"} \xB7 ${runtime.authMode === "loopback-preview" ? "\uB85C\uCEEC \uD569\uC131 \uAC80\uC218 \uBAA8\uB4DC" : "\uC18C\uC720\uC790 \uC778\uC99D \uBAA8\uB4DC"} \xB7 \uD559\uC6D0 \uC2E4\uC2DC\uAC04 \uC5F0\uACB0 \uC548 \uB428`;
      const nav = el("nav");
      nav.setAttribute("aria-label", "\uD559\uC6D0 \uC5C5\uBB34 \uBC94\uC704");
      for (const d of domains2.domains) {
        const b = el("button", `${d.label} \xB7 ${d.recordCount ? d.recordCount + "\uAC74" : "\uBBF8\uC5F0\uACB0"}`);
        b.type = "button";
        b.dataset.domain = d.id;
        b.setAttribute("aria-pressed", String(d.id === domain));
        b.addEventListener("click", () => {
          domain = d.id;
          selectDomainButton();
          void renderRecords();
        });
        nav.append(b);
      }
      work.replaceChildren(el("h2", "\uD559\uC6D0 \uC5C5\uBB34 \uC804\uCCB4 \uBC94\uC704"), el("p", "\uC6D0\uCC9C\xB7\uC11C\uC2DD\xB7\uCCA8\uBD80\uAC00 \uBBF8\uC5F0\uACB0\uC778 \uD56D\uBAA9\uC740 \uBBF8\uD655\uC778 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD569\uB2C8\uB2E4."), nav);
      if (roster.length) await selectStudent(roster[0].id);
      else {
        shell.replaceChildren(el("p", "\uC544\uC9C1 \uC18C\uC720\uC790 \uBC94\uC704 \uD559\uC0DD \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."));
        await renderRecords();
      }
      return true;
    } catch {
      if (!locked) {
        status.textContent = "\uC11C\uBC84 \uC5F0\uACB0 \uD655\uC778 \uD544\uC694";
        shell.replaceChildren(el("p", "\uC11C\uBC84 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."));
      }
      return false;
    }
  }
  window.WORKBENCH_READY = init();
})();

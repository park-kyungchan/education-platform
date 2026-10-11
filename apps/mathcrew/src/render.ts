import { copy, identity, type Copy, type Page, type Language } from './content';
import { renderSpatial } from './spatial';
import { developmentSnapshot } from './development-snapshot';
import { validatePublicSnapshot, developmentCopy, sourceDescription, maintainedSuccessors, maintainedSourceURL } from './development-sources';
export type { Page, Language } from './content';
export const pageFiles: Record<Page, string> = { home: 'index.html', privacy: 'privacy.html', 'site-use': 'site-use.html', '404': '404.html' };
export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
const e = escapeHtml;
// The site is deployed at the apex root; fallback URLs retain their request path.
// Normalize only our fixed internal navigation, never user copy or external URLs.
function rootNavigation(html: string, language: Language): string {
  const root = language === 'ko' ? '/ko/' : '/';
  return html.replaceAll('href="./"', `href="${root}"`)
    .replaceAll('href="privacy.html"', `href="${root}privacy.html"`)
    .replaceAll('href="site-use.html"', `href="${root}site-use.html"`);
}
const lines = (text: string) => e(text).replaceAll('\n', '<br>');
const signIn = (c: Copy, className = 'sign-in') => `<a class="${className}" href="${identity.productURL}">${e(c.signIn)}</a>`;
function header(page: Page, language: Language, c: Copy): string {
  const other = language === 'en' ? '/ko/' : '/';
  return `<a class="skip" href="#main">${e(c.skip)}</a><header class="site-header wrap"><a class="brand" href="./" aria-label="mathCrew"><svg class="brand-symbol" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><path d="M4 27 28 5M16 16h12"/><circle class="brand-point" cx="24" cy="8" r="3"/></svg>mathCrew</a><nav aria-label="${e(c.navigation)}"><div class="language-switch" aria-label="${e(c.language)}"><span lang="${language}" aria-current="true">${language === 'en' ? 'EN' : '한국어'}</span><a href="${other}${pageFiles[page]}" lang="${language === 'en' ? 'ko' : 'en'}" hreflang="${language === 'en' ? 'ko' : 'en'}">${language === 'en' ? '한국어' : 'EN'}</a></div>${signIn(c)}</nav></header>`;
}
function geometry(c: Copy): string {
  return `<figure class="coordinate-sheet"><svg class="construction" viewBox="0 0 640 540" role="img" aria-labelledby="geometry-title geometry-description"><title id="geometry-title">${e(c.geometryTitle)}</title><desc id="geometry-description">${e(c.geometryDescription)}</desc><g class="guides"><path d="M40 100H600M40 185H600M40 355H600M40 440H600M90 50V480M175 50V480M345 50V480M430 50V480M515 50V480"/></g><g class="axes"><path d="M40 270H600M260 50V480"/><path d="m590 265 10 5-10 5M255 60l5-10 5 10"/></g><circle class="unit-circle" cx="260" cy="270" r="170"/><path class="projection" d="M362 134V270"/><path class="radius" d="M260 270 362 134"/><path class="tangent" d="M170 -10 570 290"/><path class="right-angle" d="m350 150 16 12 12-16"/><circle class="origin" cx="260" cy="270" r="4"/><circle class="point" cx="362" cy="134" r="8"/><g class="math-labels"><text x="280" y="306">O</text><text x="378" y="117">P (3/5, 4/5)</text><text x="455" y="403">x² + y² = 1</text><text x="414" y="180" transform="rotate(37 414 180)">3x + 4y = 5</text><text x="368" y="306">3/5</text><text x="603" y="278">x</text><text x="269" y="56">y</text></g></svg><figcaption>${e(c.geometryCaption)}</figcaption><details class="construction-notes"><summary>${e(c.construction)}</summary><p>${e(c.constructionBody)}</p></details></figure>`;
}
function development(language: Language): string {
  const sources = validatePublicSnapshot(developmentSnapshot).repositories;
  const c = developmentCopy[language];
  return `<section class="development wrap" id="development" aria-labelledby="development-title"><h2 id="development-title">${e(c.title)}</h2><p class="development-intro">${e(c.body)}</p><p>${language === 'en' ? 'Maintained source (repository access required): ' : '현재 유지보수 소스(저장소 접근 권한 필요): '}${maintainedSuccessors.map(row=>`<a href="${e(row.url)}">${e(row.name)}</a>`).join(' · ')}</p><p>${language === 'en' ? 'Source succession observed 2026-10-11; original snapshot URLs are retained in provenance:' : '2026-10-11에 확인한 source succession입니다. 이전 스냅샷 URL은 provenance에 보존합니다:'}</p><ul class="source-list">${sources.map(row => `<li class="source-row"><div><h3>${e(row.profile)}</h3><p>${e(sourceDescription(row.profile, language))}</p></div><a href="${e(maintainedSourceURL(row.profile))}" aria-label="${e(c.link)}: ${e(row.profile)}">${e(c.link)}<span aria-hidden="true"> ↗</span></a></li>`).join('')}</ul></section>`;
}
function home(c: Copy, language: Language): string {
  return `<main id="main">
<section class="hero" aria-labelledby="hero-title"><div class="hero-inner wrap"><div class="hero-copy"><h1 id="hero-title">${c.headline.map(e).join('<br>')}</h1><p class="intro">${e(c.intro)}</p><a class="hero-link" href="#inquiry">${e(c.explore)}</a></div>${renderSpatial(c, e)}</div></section>
<section class="vision" id="inquiry" aria-labelledby="vision-title"><div class="wrap vision-inner"><div class="vision-proposition"><p class="section-context">${e(c.visionTitle)}</p><h2 id="vision-title">${lines(c.visionHeading)}</h2><p>${e(c.visionBody)}</p><details class="relationship"><summary>${e(c.relationshipSummary)}</summary>${geometry(c)}</details></div><div class="reading">${c.inquirySections.map(([title, body]) => `<section><h3>${e(title)}</h3><p>${e(body)}</p></section>`).join('')}<p class="ai-boundary">${e(c.aiBoundary)}</p></div></div></section>
<section class="product wrap" id="dc" aria-labelledby="product-title"><div class="product-name" aria-hidden="true">dc<span class="product-dot"></span></div><div class="product-copy"><h2 id="product-title">${e(c.productTitle)}</h2><p>${e(c.productBody)}</p><p class="pilot-state">${e(c.privateState)}</p>${signIn(c, 'button')}<p class="access-note">${e(c.accessNote)}</p></div></section>
<section class="founder wrap" aria-labelledby="founder-title"><div><h2 id="founder-title">${e(c.founderTitle)}</h2><p class="founder-name">${identity.founder}</p><p class="muted">${e(c.founderLocation)}</p></div><p>${e(c.founderBody)}</p></section>
${development(language)}
<section class="contact wrap" id="contact" aria-labelledby="contact-title"><div><h2 id="contact-title">${e(c.contactTitle)}</h2><p>${e(c.contactBody)}</p></div><a class="mail" href="mailto:${identity.email}" aria-label="${e(c.emailAction)}: ${identity.email}">${identity.email}</a></section></main>`;
}
function legal(page: 'privacy' | 'site-use', c: Copy): string {
  const sections = page === 'privacy' ? c.privacySections : c.useSections;
  return `<main id="main" class="legal wrap"><a class="back" href="./">${e(c.home)}</a><h1>${e(c.titles[page].split(' | ')[0]!)}</h1><p class="intro">${e(c.descriptions[page])}</p>${sections.map(([title, body]) => `<section><h2>${e(title)}</h2><p>${e(body)}</p></section>`).join('')}<a class="legal-mail" href="mailto:${identity.email}">${identity.email}</a></main>`;
}
function footer(c: Copy): string {
  return `<footer class="site-footer wrap"><div><p>${e(c.legalStatus)}</p><a class="footer-mail" href="mailto:${identity.email}">${identity.email}</a></div><nav aria-label="${e(c.siteUse)}"><a href="privacy.html">${e(c.privacy)}</a><a href="site-use.html">${e(c.siteUse)}</a></nav></footer>`;
}
export function renderPage(page: Page, language: Language = 'en'): string {
  return rootNavigation(renderDocument(page, language), language);
}
function renderDocument(page: Page, language: Language): string {
  if (!Object.hasOwn(pageFiles, page) || !Object.hasOwn(copy, language)) throw new Error('Unknown page or language');
  const c = copy[language];
  const file = page === 'home' ? '' : pageFiles[page];
  const canonical = `${identity.origin}/${language === 'ko' ? 'ko/' : ''}${file}`;
  const prefix = '/';
  const body = page === 'home' ? home(c, language) : page === '404' ? `<main id="main" class="legal wrap"><h1>${e(c.missing)}</h1><p>${e(c.descriptions['404'])}</p><a class="button" href="./">${e(c.home)}</a></main>` : legal(page, c);
  return `<!doctype html>\n<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(c.titles[page])}</title><meta name="description" content="${e(c.descriptions[page])}"><meta name="theme-color" content="#2451E6"><meta name="referrer" content="strict-origin-when-cross-origin">${page === '404' ? '<meta name="robots" content="noindex">' : ''}<link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="en" href="${identity.origin}/${file}"><link rel="alternate" hreflang="ko" href="${identity.origin}/ko/${file}"><link rel="alternate" hreflang="x-default" href="${identity.origin}/${file}"><meta property="og:type" content="website"><meta property="og:title" content="${e(c.titles[page])}"><meta property="og:description" content="${e(c.descriptions[page])}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="${language === 'en' ? 'en_US' : 'ko_KR'}"><meta property="og:locale:alternate" content="${language === 'en' ? 'ko_KR' : 'en_US'}"><link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml"><link rel="preload" href="${prefix}assets/fonts/NanumGothic-Regular.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="${prefix}styles.css"></head><body>${header(page, language, c)}${body}${footer(c)}</body></html>\n`;
}

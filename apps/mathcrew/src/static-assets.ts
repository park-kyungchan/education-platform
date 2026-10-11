// Explicit publication allowlist, never inferred from directory contents.
// Font provenance stays in source evidence; expose only the font and its license.
export const fontAssets = ['assets/fonts/NanumGothic-Regular.ttf', 'assets/fonts/nanum-gothic-license.txt'] as const;
export const publicFiles = ['index.html', 'privacy.html', 'site-use.html', '404.html', 'ko/index.html', 'ko/privacy.html', 'ko/site-use.html', 'ko/404.html', 'styles.css', 'favicon.svg', ...fontAssets] as const;

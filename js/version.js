/* La version du site, posee par outils/version.mjs. La page porte la meme
   dans <meta name="version"> : si elles different, le navigateur a melange
   une page recente et un script garde en cache. */
export const VERSION = 'b602aab638';

export function versionPerimee() {
  const page = document.querySelector('meta[name="version"]')?.content;
  return Boolean(page && VERSION && page !== VERSION);
}

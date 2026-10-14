/* ===========================================================================
   Les liens pre-remplis.

       https://…/Dinguerie_du_val/#adultes=2&enfants_moins_14=1&loyer=650&dette_locative=1200

   Les parametres vont apres le « # » : cette partie de l'adresse n'est jamais
   envoyee au serveur, elle ne laisse donc de trace dans aucun journal.
   On accepte aussi « / » comme separateur (#loyer=650/charges=80) et la
   forme classique « ?loyer=650 ».

   Seuls les champs coches « lien » dans l'admin sont acceptes, et jamais un
   champ d'une section nominative ni un champ texte : un lien ne peut pas
   porter de nom, meme par erreur.
   =========================================================================== */

export function champsAutorises(config) {
  const champs = [];
  for (const s of config.sections) {
    if (s.nominatif || !s.champs) continue;
    for (const c of s.champs) if (c.url && (c.type === 'nombre' || c.type === 'montant')) champs.push({ ...c, section: s.titre });
  }
  return champs;
}

function paires(loc) {
  const brut = [loc.search.replace(/^\?/, ''), loc.hash.replace(/^#\/?/, '')].filter(Boolean).join('&');
  return brut.split(/[&/]/).filter((p) => p.includes('=')).map((p) => {
    const i = p.indexOf('=');
    const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };
    return [dec(p.slice(0, i)).trim().toLowerCase(), dec(p.slice(i + 1)).trim()];
  });
}

/* Un nombre venu de Power BI peut s'ecrire 12,5 ou 12.5, voire « 650, » :
   FORMAT(x; "0.##") laisse un separateur orphelin sur un entier. */
export function lireNombre(s) {
  const t = String(s).replace(/[\s €]/g, '').replace(/[.,]$/, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function lirePrerempli(config, loc = window.location) {
  const autorises = new Map(champsAutorises(config).map((c) => [c.id, c]));
  const valeurs = {};
  const appliques = [];
  const ignores = [];
  for (const [cle, brut] of paires(loc)) {
    const champ = autorises.get(cle);
    if (!champ) { ignores.push({ cle, raison: 'paramètre non autorisé' }); continue; }
    const n = lireNombre(brut);
    if (n === null || n < 0) { ignores.push({ cle, raison: `valeur « ${brut} » illisible` }); continue; }
    valeurs[cle] = champ.type === 'nombre' ? Math.round(n) : n;
    appliques.push(champ);
  }
  return { valeurs, appliques, ignores };
}

export function construireLien(base, valeurs) {
  const p = Object.entries(valeurs)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v).replace(',', '.'))}`);
  return `${String(base).replace(/#.*$/, '')}${p.length ? `#${p.join('&')}` : ''}`;
}

/* La formule DAX qui fabrique le lien dans Power BI, une ligne par parametre.
   mode « colonne » : colonne calculee de la table ; mode « mesure » : mesure
   a poser dans un tableau (une ligne = un contexte). */
export function genererDax({ base, table, colonnes, mode = 'colonne', nom = 'Lien diagnostic' }) {
  const t = `'${String(table || 'Table').replace(/'/g, "''")}'`;
  const lignes = Object.entries(colonnes).filter(([, col]) => col && col.trim());
  if (!lignes.length) return '-- Renseignez au moins une colonne Power BI en face d\'un paramètre.';
  const ref = (col) => {
    const c = `${t}[${col.trim().replace(/\]/g, ']]')}]`;
    return mode === 'mesure' ? `SELECTEDVALUE ( ${c} )` : c;
  };
  const vars = lignes.map(([id, col], n) => `VAR _v${n + 1} = ${ref(col)}  -- ${id}`);
  const morceaux = lignes.map(([id], n) =>
    `    IF ( NOT ISBLANK ( _v${n + 1} ), "&${id}=" & FORMAT ( _v${n + 1}, "0.##" ) )`);
  return [
    `${nom} =`,
    `VAR _base = "${String(base).replace(/#.*$/, '')}#"`,
    ...vars,
    'VAR _params =',
    morceaux.join(' &\n'),
    'RETURN',
    '    _base & MID ( _params, 2, 2000 )',
  ].join('\n');
}

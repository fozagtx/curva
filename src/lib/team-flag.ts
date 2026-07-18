// Map TxLINE national-team names -> ISO / FlagCDN codes for World Cup fixtures.

const TEAM_ISO: Record<string, string> = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  "bosnia and herzegovina": "ba",
  bosnia: "ba",
  brazil: "br",
  cameroon: "cm",
  canada: "ca",
  "cape verde": "cv",
  "cabo verde": "cv",
  chile: "cl",
  china: "cn",
  colombia: "co",
  "costa rica": "cr",
  croatia: "hr",
  curacao: "cw",
  "curaçao": "cw",
  "czech republic": "cz",
  czechia: "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  france: "fr",
  germany: "de",
  ghana: "gh",
  haiti: "ht",
  honduras: "hn",
  iran: "ir",
  iraq: "iq",
  "ivory coast": "ci",
  "cote d'ivoire": "ci",
  "côte d'ivoire": "ci",
  italy: "it",
  jamaica: "jm",
  japan: "jp",
  jordan: "jo",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  holland: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  norway: "no",
  panama: "pa",
  paraguay: "py",
  peru: "pe",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  "south africa": "za",
  "south korea": "kr",
  korea: "kr",
  "korea republic": "kr",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  turkiye: "tr",
  "türkiye": "tr",
  uruguay: "uy",
  usa: "us",
  "united states": "us",
  "u.s.a.": "us",
  uzbekistan: "uz",
  wales: "gb-wls",
  "dr congo": "cd",
  congo: "cd",
  "democratic republic of the congo": "cd",
};

function normalizeTeam(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ISO / FlagCDN code, or null if unknown. */
export function teamIso(name: string): string | null {
  const key = normalizeTeam(name);
  if (TEAM_ISO[key]) return TEAM_ISO[key];
  // soft match: "Republic of Korea" etc.
  for (const [k, code] of Object.entries(TEAM_ISO)) {
    if (key.includes(k) || k.includes(key)) return code;
  }
  return null;
}

/** FlagCDN PNG URL (w40 / w80). */
export function teamFlagUrl(name: string, width: 40 | 80 = 40): string | null {
  const iso = teamIso(name);
  if (!iso) return null;
  return `https://flagcdn.com/w${width}/${iso}.png`;
}

export function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

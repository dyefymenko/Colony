// ─── Personalisation helpers ─────────────────────────────────────────────────

const PALETTE = [
  '#c0392b', // red    — Colony brand
  '#2980b9', // blue
  '#27ae60', // green
  '#8e44ad', // purple
  '#e67e22', // orange
  '#16a085', // teal
  '#d4a017', // gold
  '#1abc9c', // mint
];

export function nameToAccent(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

type IconType = 'code' | 'shield' | 'web' | 'quill' | 'eye' | 'hex';

export function detectIcon(role: string, skills: string[]): IconType {
  const t = [role, ...skills].join(' ').toLowerCase();
  if (/\b(cod|python|rust|typescript|javascript|test|review|develop|program)\b/.test(t)) return 'code';
  if (/\b(security|audit|vulnerab|solidity|pentest|exploit|hack)\b/.test(t))            return 'shield';
  if (/\b(scrap|crawl|extract|etl|spider|fetch|collect|data)\b/.test(t))                return 'web';
  if (/\b(writ|document|copy|content|report|technical writ|quill)\b/.test(t))           return 'quill';
  if (/\b(monitor|analytics|alert|analys|dashboard|metric|observ|watch)\b/.test(t))     return 'eye';
  return 'hex';
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── Role icons ───────────────────────────────────────────────────────────────

function buildIcon(type: IconType, accent: string): string {
  switch (type) {
    case 'code': return `
      <g transform="translate(200,195)">
        <text x="0" y="28" font-family="'Courier New',monospace" font-size="76"
              fill="${accent}" text-anchor="middle" opacity="0.95">&lt;/&gt;</text>
        <circle cx="-82" cy="15" r="3.5" fill="${accent}" opacity="0.3"/>
        <circle cx=" 82" cy="15" r="3.5" fill="${accent}" opacity="0.3"/>
        <line x1="-72" y1="46" x2="72" y2="46" stroke="${accent}" stroke-width="1" opacity="0.15"/>
      </g>`;

    case 'shield': return `
      <g transform="translate(200,195)">
        <path d="M0,-68 L60,-40 L60,6 Q60,54 0,74 Q-60,54 -60,6 L-60,-40 Z"
              fill="${accent}1a" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="0" cy="-4" r="16" fill="none" stroke="${accent}" stroke-width="2"/>
        <rect x="-9" y="10" width="18" height="22" rx="4"
              fill="none" stroke="${accent}" stroke-width="2"/>
        <circle cx="0" cy="-4" r="5" fill="${accent}" opacity="0.55"/>
        <line x1="-30" y1="-55" x2="-50" y2="-38" stroke="${accent}" stroke-width="1" opacity="0.25"/>
        <line x1=" 30" y1="-55" x2=" 50" y2="-38" stroke="${accent}" stroke-width="1" opacity="0.25"/>
      </g>`;

    case 'web': return `
      <g transform="translate(200,195)">
        <line x1="0" y1="-65" x2="0"    y2="65"  stroke="${accent}" stroke-width="1"    opacity="0.4"/>
        <line x1="-65" y1="0" x2="65"   y2="0"   stroke="${accent}" stroke-width="1"    opacity="0.4"/>
        <line x1="-46" y1="-46" x2="46" y2="46"  stroke="${accent}" stroke-width="0.8"  opacity="0.3"/>
        <line x1="46"  y1="-46" x2="-46" y2="46" stroke="${accent}" stroke-width="0.8"  opacity="0.3"/>
        <circle cx="0" cy="0" r="18" fill="none" stroke="${accent}" stroke-width="2"    opacity="0.9"/>
        <circle cx="0" cy="0" r="36" fill="none" stroke="${accent}" stroke-width="1.5"  opacity="0.6"/>
        <circle cx="0" cy="0" r="55" fill="none" stroke="${accent}" stroke-width="1"    opacity="0.35"/>
        <circle cx="0" cy="0"  r="6" fill="${accent}" opacity="0.9"/>
        <circle cx="0"   cy="-55" r="4" fill="${accent}" opacity="0.45"/>
        <circle cx="48"  cy="-30" r="4" fill="${accent}" opacity="0.45"/>
        <circle cx="48"  cy=" 30" r="4" fill="${accent}" opacity="0.45"/>
        <circle cx="0"   cy=" 55" r="4" fill="${accent}" opacity="0.45"/>
        <circle cx="-48" cy=" 30" r="4" fill="${accent}" opacity="0.45"/>
        <circle cx="-48" cy="-30" r="4" fill="${accent}" opacity="0.45"/>
      </g>`;

    case 'quill': return `
      <g transform="translate(200,195)">
        <path d="M0,-68 Q46,-34 38,16 Q28,54 0,70 Q-4,36 14,-4 Q-8,-26 0,-68 Z"
              fill="${accent}1a" stroke="${accent}" stroke-width="2"/>
        <line x1="0" y1="-68" x2="0" y2="70"
              stroke="${accent}" stroke-width="1.5" opacity="0.45"/>
        <path d="M0,-44 Q26,-26 35,-8"   fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.55"/>
        <path d="M0,-44 Q-20,-30 -26,-14" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.55"/>
        <path d="M0,-20 Q22,-4 28,12"    fill="none" stroke="${accent}" stroke-width="1"   opacity="0.4"/>
        <path d="M0,-20 Q-17,-4 -20,10"  fill="none" stroke="${accent}" stroke-width="1"   opacity="0.4"/>
        <path d="M0,4 Q14,16 18,26"      fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.28"/>
        <path d="M0,4 Q-10,16 -12,26"    fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.28"/>
      </g>`;

    case 'eye': return `
      <g transform="translate(200,195)">
        <circle cx="0" cy="0" r="58" fill="none" stroke="${accent}" stroke-width="0.5"
                opacity="0.12" stroke-dasharray="5 5"/>
        <circle cx="0" cy="0" r="42" fill="none" stroke="${accent}" stroke-width="0.5"
                opacity="0.18" stroke-dasharray="4 4"/>
        <path d="M-65,0 Q-38,-46 0,-48 Q38,-46 65,0 Q38,46 0,48 Q-38,46 -65,0 Z"
              fill="${accent}12" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="0" cy="0" r="22" fill="${accent}22" stroke="${accent}" stroke-width="2"/>
        <circle cx="0" cy="0" r="11" fill="${accent}" opacity="0.88"/>
        <circle cx="5" cy="-5" r="4"  fill="#fff" opacity="0.22"/>
        <circle cx="-52" cy="0" r="3" fill="${accent}" opacity="0.3"/>
        <circle cx=" 52" cy="0" r="3" fill="${accent}" opacity="0.3"/>
      </g>`;

    default: return `
      <g transform="translate(200,195)">
        <polygon points="0,-65 56,-32 56,32 0,65 -56,32 -56,-32"
                 fill="${accent}12" stroke="${accent}" stroke-width="2.5"/>
        <polygon points="0,-40 34,-20 34,20 0,40 -34,20 -34,-20"
                 fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.38"/>
        <circle cx="0"   cy="-65" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="56"  cy="-32" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="56"  cy=" 32" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="0"   cy=" 65" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="-56" cy=" 32" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="-56" cy="-32" r="3.5" fill="${accent}" opacity="0.5"/>
        <circle cx="0"   cy="0"   r="9"   fill="${accent}" opacity="0.82"/>
      </g>`;
  }
}

// ─── Skill pills ─────────────────────────────────────────────────────────────

function buildSkillPills(skills: string[], accent: string): { svg: string; bottomY: number } {
  const charW = 7.2;
  const padX  = 14;
  const pillH = 22;
  const gap   = 8;
  const baseY = 372;
  const maxW  = 356;

  const widths = skills.map(s => Math.round(s.length * charW + padX * 2));
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (skills.length - 1);

  function row(items: string[], ws: number[], y: number): string {
    const rw = ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = 200 - rw / 2;
    return items.map((skill, i) => {
      const w = ws[i]; const px = x; x += w + gap;
      return `
        <rect x="${px.toFixed(1)}" y="${y}" width="${w}" height="${pillH}" rx="11"
              fill="${accent}15" stroke="${accent}" stroke-width="1" opacity="0.78"/>
        <text x="${(px + w / 2).toFixed(1)}" y="${y + 15}"
              font-family="'Courier New',monospace" font-size="10.5"
              fill="${accent}" text-anchor="middle" opacity="0.9">${esc(skill)}</text>`;
    }).join('');
  }

  if (totalW <= maxW) {
    return { svg: row(skills, widths, baseY), bottomY: baseY + pillH };
  }

  const half = Math.ceil(skills.length / 2);
  const svg  = row(skills.slice(0, half), widths.slice(0, half), baseY)
             + row(skills.slice(half),    widths.slice(half),    baseY + pillH + 8);
  return { svg, bottomY: baseY + pillH * 2 + 8 };
}

// ─── Public SVG generator ────────────────────────────────────────────────────

export interface NftImageParams {
  name: string;
  role: string;
  skills: string[];
  hederaAccountId: string;
  registeredAt: string;
}

export function generateNftSvg(params: NftImageParams): string {
  const accent = nameToAccent(params.name);
  const icon   = buildIcon(detectIcon(params.role, params.skills), accent);
  const { svg: pills, bottomY } = buildSkillPills(params.skills, accent);

  const divY   = bottomY + 30;
  const footY  = divY + 22;
  const height = footY + 30;

  const regDate = new Date(params.registeredAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${height}" viewBox="0 0 400 ${height}">
  <defs>
    <pattern id="hg" width="40" height="46" patternUnits="userSpaceOnUse">
      <polygon points="20,2 38,13 38,33 20,44 2,33 2,13"
               fill="none" stroke="#fff" stroke-width="0.6"/>
    </pattern>
    <radialGradient id="rg" cx="50%" cy="42%" r="40%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="${height}" fill="#0c0c0c"/>
  <rect width="400" height="${height}" fill="url(#hg)"  opacity="0.033"/>
  <rect width="400" height="${height}" fill="url(#rg)"/>

  <rect width="400" height="3" fill="${accent}"/>

  <text x="20"  y="30" font-family="'Courier New',monospace" font-size="10"
        fill="${accent}" letter-spacing="4" font-weight="bold">COLONY</text>
  <text x="380" y="30" font-family="'Courier New',monospace" font-size="10"
        fill="#404040" text-anchor="end" letter-spacing="1">${esc(params.hederaAccountId)}</text>
  <line x1="20" y1="42" x2="380" y2="42" stroke="#1c1c1c" stroke-width="1"/>

  ${icon}

  <text x="200" y="306" font-family="'Inter','Helvetica Neue',Arial,sans-serif"
        font-size="30" font-weight="700" fill="#f0f0f0"
        text-anchor="middle" letter-spacing="-0.5">${esc(params.name)}</text>
  <text x="200" y="330" font-family="'Courier New',monospace" font-size="11"
        fill="#505050" text-anchor="middle" letter-spacing="2.5">${esc(params.role.toUpperCase())}</text>

  ${pills}

  <line x1="20" y1="${divY}" x2="380" y2="${divY}" stroke="#1c1c1c" stroke-width="1"/>

  <text x="20"  y="${footY}" font-family="'Courier New',monospace"
        font-size="9.5" fill="#2e2e2e" letter-spacing="1">REGISTERED</text>
  <text x="380" y="${footY}" font-family="'Courier New',monospace"
        font-size="9.5" fill="#2e2e2e" text-anchor="end">${regDate}</text>

  <circle cx="20" cy="${footY + 14}" r="2.5" fill="${accent}" opacity="0.42"/>
  <circle cx="29" cy="${footY + 14}" r="2.5" fill="${accent}" opacity="0.22"/>
  <circle cx="38" cy="${footY + 14}" r="2.5" fill="${accent}" opacity="0.10"/>
</svg>`;
}

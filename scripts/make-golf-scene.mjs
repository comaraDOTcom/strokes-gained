/**
 * Generates public/golf-scene.svg — the illustrated backdrop (pines, creek, a green with
 * the flag, azalea banks) used behind the sign-in page and as the app's footer.
 * Original artwork in the app's flat style; deterministic (seeded), so re-running it
 * without changes produces the same file.   node scripts/make-golf-scene.mjs
 */
import fs from 'node:fs';

let seed = 20260921;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r1 = (n) => Math.round(n * 10) / 10;
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

const W = 1200, H = 600;
const out = [];
const add = (s) => out.push(s);

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">`);
add(`<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f2ea"/><stop offset=".55" stop-color="#e6efe9"/><stop offset="1" stop-color="#d5e6e0"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d8e0"/><stop offset="1" stop-color="#8fbccb"/></linearGradient>
<clipPath id="fw"><path d="M0 418 C250 378 500 430 750 398 S1100 378 1200 408 L1200 600 L0 600Z"/></clipPath>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);

// Far tree line: overlapping canopies with the odd pine spire.
for (let i = 0; i <= 44; i++) {
  const x = i * 28 + rnd() * 10 - 5, r = 18 + rnd() * 17, cy = 338 - rnd() * 14;
  add(`<circle cx="${r1(x)}" cy="${r1(cy)}" r="${r1(r)}" fill="${pick(['#2f5a41', '#274d38', '#356549'])}"/>`);
  if (rnd() < 0.3) add(`<path d="M${r1(x - 9)} ${r1(cy - 8)} L${r1(x)} ${r1(cy - 50 - rnd() * 22)} L${r1(x + 9)} ${r1(cy - 8)}Z" fill="#23402f"/>`);
}
add(`<rect x="0" y="336" width="${W}" height="40" fill="#2a5240"/>`);

// Rolling ground, back to front.
add(`<path d="M0 362 C200 326 400 352 600 342 S1000 314 1200 352 L1200 600 L0 600Z" fill="#86b886"/>`);
add(`<path d="M0 418 C250 378 500 430 750 398 S1100 378 1200 408 L1200 600 L0 600Z" fill="#5fa46c"/>`);
add(`<g clip-path="url(#fw)" opacity=".1" fill="#fff">`);
for (let i = -2; i < 16; i++) add(`<path d="M${i * 90} 600 L${i * 90 + 170} 370 L${i * 90 + 215} 370 L${i * 90 + 45} 600Z"/>`);
add(`</g>`);

// Tall pines: bare trunks with canopy high up. Drawn before the mid-ground azaleas.
const pine = (x, top, base, s) => {
  add(`<rect x="${x - 3 * s}" y="${top + 30}" width="${6 * s}" height="${base - top - 30}" fill="#5a4632"/>`);
  for (let i = 0; i < 7; i++) {
    const cx = x + (rnd() - 0.5) * 80 * s, cy = top + rnd() * 70 * s, rx = (26 + rnd() * 26) * s, ry = (13 + rnd() * 10) * s;
    add(`<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${pick(['#1f3d2c', '#2a5240', '#244836'])}"/>`);
  }
};
pine(86, 96, 446, 1.15); pine(178, 150, 440, 0.95); pine(1128, 88, 438, 1.15); pine(1036, 160, 432, 0.9); pine(292, 214, 420, 0.7); pine(948, 222, 412, 0.65);

// Azalea bank: dark foliage with blossoms scattered over it.
const PINKS = ['#e2679a', '#f08db5', '#c9447f', '#f6b5cf', '#d9528c', '#f6b5cf', '#e2679a', '#f08db5', '#c9447f', '#ffffff'];
const azalea = (cx, cy, rx, ry, n, size) => {
  add(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2b5a3e"/>`);
  add(`<ellipse cx="${cx - rx * 0.25}" cy="${cy - ry * 0.2}" rx="${r1(rx * 0.7)}" ry="${r1(ry * 0.75)}" fill="#34684a"/>`);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.94;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d - ry * 0.12;
    add(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size * (0.55 + rnd() * 0.7))}" fill="${pick(PINKS)}"/>`);
  }
};
// mid-ground, under the pines and behind the green
azalea(140, 438, 84, 20, 46, 4); azalea(1076, 426, 92, 22, 50, 4); azalea(300, 414, 46, 11, 20, 3); azalea(946, 406, 50, 11, 20, 3);

// The green, bunkers and the flag.
add(`<ellipse cx="610" cy="446" rx="48" ry="10" fill="#efe6c8"/><ellipse cx="906" cy="440" rx="40" ry="8" fill="#efe6c8"/>`);
add(`<ellipse cx="760" cy="436" rx="124" ry="21" fill="#9ad592"/><ellipse cx="760" cy="434" rx="106" ry="15" fill="#a9de9f"/>`);
add(`<ellipse cx="771.5" cy="436" rx="7" ry="2.2" fill="#1f3d2c" opacity=".55"/>`);
add(`<rect x="770" y="362" width="3.2" height="74" rx="1.2" fill="#f7f5ee"/><path d="M773.2 362 L808 372.5 L773.2 383Z" fill="#e9b940"/>`);

// Creek across the front of the green.
add(`<path d="M0 470 C200 454 380 494 600 476 S980 452 1200 478 L1200 504 C980 480 800 510 600 504 S200 484 0 500Z" fill="url(#water)"/>`);
add(`<path d="M120 478 C220 472 300 486 380 486 M700 486 C800 480 900 470 1010 470" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>`);

// Front bank and the big azalea drifts.
add(`<path d="M0 512 C300 486 700 532 1200 496 L1200 600 L0 600Z" fill="#3f8454"/>`);
azalea(76, 548, 128, 44, 100, 6.5); azalea(284, 574, 130, 36, 90, 6.5); azalea(1124, 540, 124, 46, 100, 6.5); azalea(934, 572, 140, 38, 94, 6.5); azalea(500, 592, 104, 24, 52, 5.5); azalea(716, 594, 112, 22, 52, 5.5);
add(`</svg>`);

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/golf-scene.svg', out.join('\n') + '\n');
console.log(`public/golf-scene.svg  ${(fs.statSync('public/golf-scene.svg').size / 1024).toFixed(1)} KB`);

/**
 * Generates the illustrated backdrops (pines, creek, a green with the flag, flowering banks) used
 * behind the sign-in page, on the Rounds page and as the app's footer — one per season:
 *
 *   public/golf-scene-spring.svg   windy spring: azaleas in bloom, petals on the wind
 *   public/golf-scene-summer.svg   sunny summer: sun, bright fairways, flag hanging still
 *   public/golf-scene-autumn.svg   windy autumn: turning trees, leaves blowing across
 *   public/golf-scene-winter.svg   rainy winter: grey sky, rain, holly berries, puddles
 *
 * Every season shares the same layout (the same seeded sequence drives the geometry), so switching
 * scene never moves the green or the flag. Only colours and weather change. Original artwork in the
 * app's flat style; deterministic, so re-running it without changes produces the same files.
 *   node scripts/make-golf-scene.mjs
 */
import fs from 'node:fs';

const W = 1200, H = 600;
const r1 = (n) => Math.round(n * 10) / 10;
const seeded = (start) => {
  let seed = start;
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Per-season palette. The top sky stop is always the paper colour (#f3f2ea) so the artwork blends
 * into the page with no hard edge.
 */
const SEASONS = {
  spring: {
    sky: ['#f3f2ea', '#e6efe9', '#d5e6e0'],
    water: ['#b9d8e0', '#8fbccb'],
    farTrees: ['#2f5a41', '#274d38', '#356549'], spire: '#23402f', treeBand: '#2a5240',
    ground: ['#86b886', '#5fa46c', '#3f8454'], stripes: 0.1,
    pines: ['#1f3d2c', '#2a5240', '#244836'],
    green: ['#9ad592', '#a9de9f'], sand: '#efe6c8',
    shrub: ['#2b5a3e', '#34684a'],
    blossoms: ['#e2679a', '#f08db5', '#c9447f', '#f6b5cf', '#d9528c', '#f6b5cf', '#e2679a', '#f08db5', '#c9447f', '#ffffff'],
    blossomSize: 1, flag: 'wind',
  },
  summer: {
    sky: ['#f3f2ea', '#eef0dc', '#cfe4ea'],
    water: ['#a9d6e4', '#6fb0c8'],
    farTrees: ['#2f6a41', '#28603a', '#3a7a4b'], spire: '#23452f', treeBand: '#2c5c3f',
    ground: ['#95c983', '#62ad5f', '#3f8a4c'], stripes: 0.15,
    pines: ['#1f3d2c', '#2a5240', '#244836'],
    green: ['#a3dd8f', '#b4e79f'], sand: '#f3e7bf',
    shrub: ['#2f6a3f', '#3a7a4b'],
    // Hydrangea blues and whites, with the odd buttercup.
    blossoms: ['#8fb3e0', '#a9c4ec', '#6f95d0', '#ffffff', '#c9d9f2', '#8fb3e0', '#f2d65c', '#a9c4ec', '#ffffff', '#6f95d0'],
    blossomSize: 1, flag: 'still',
  },
  autumn: {
    sky: ['#f3f2ea', '#f0e9dc', '#e6dccb'],
    water: ['#b3ccd0', '#86a9b3'],
    farTrees: ['#c9702e', '#a8462a', '#d9a03a', '#2f5a41', '#b8612b', '#8e3b24'], spire: '#23402f', treeBand: '#6d4a2c',
    ground: ['#a9b87c', '#7fa062', '#5d8049'], stripes: 0.08,
    pines: ['#1f3d2c', '#2a5240', '#244836'],
    green: ['#9ccb86', '#abd594'], sand: '#eadcb4',
    shrub: ['#7a4424', '#8f5a2a'],
    blossoms: ['#d9822b', '#c05a2a', '#e8b13a', '#a8412a', '#f0c75a', '#d9822b', '#b54f25', '#e8b13a', '#c05a2a', '#8e3b24'],
    blossomSize: 0.9, flag: 'wind',
  },
  winter: {
    sky: ['#f3f2ea', '#e3e5e2', '#c9d0d1'],
    water: ['#a9b9bd', '#7f949a'],
    farTrees: ['#3b5446', '#34493e', '#415a4c'], spire: '#243a2f', treeBand: '#33483d',
    ground: ['#9db293', '#789a77', '#56775a'], stripes: 0.06,
    pines: ['#1c3428', '#253f32', '#20392d'],
    green: ['#8fbf88', '#9cc893'], sand: '#dcd6c2',
    shrub: ['#22432f', '#2a4e37'],
    // Holly: mostly leaf, a scattering of red berries.
    blossoms: ['#1f3d2c', '#2a5240', '#b3261e', '#2b5a3e', '#c0392b', '#34684a', '#1f3d2c', '#b3261e', '#2a5240', '#244836'],
    blossomSize: 0.8, flag: 'still',
  },
};

function build(name, s) {
  const rnd = seeded(20260921); // shared layout: same sequence for every season
  const fx = seeded(7031); // weather: its own sequence, so it never disturbs the layout
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const fxPick = (xs) => xs[Math.floor(fx() * xs.length)];
  const out = [];
  const add = (str) => out.push(str);

  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">`);
  add(`<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset=".55" stop-color="${s.sky[1]}"/><stop offset="1" stop-color="${s.sky[2]}"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.water[0]}"/><stop offset="1" stop-color="${s.water[1]}"/></linearGradient>
<clipPath id="fw"><path d="M0 418 C250 378 500 430 750 398 S1100 378 1200 408 L1200 600 L0 600Z"/></clipPath>
</defs>`);
  add(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);

  // Sky weather, behind the trees.
  if (name === 'summer') {
    add(`<circle cx="300" cy="170" r="84" fill="#f6e3a0" opacity=".25"/><circle cx="300" cy="170" r="58" fill="#f6e3a0" opacity=".35"/>`);
    add(`<circle cx="300" cy="170" r="38" fill="#f4d56a"/>`);
  }
  if (name === 'winter') {
    // Low, soft rain clouds.
    for (const [cx, cy, k] of [[180, 190, 1.1], [520, 160, 1.3], [880, 200, 1.2], [1120, 150, 0.9]]) {
      add(`<g fill="#b8c0c1" opacity=".55"><ellipse cx="${cx}" cy="${cy}" rx="${r1(120 * k)}" ry="${r1(26 * k)}"/><ellipse cx="${r1(cx - 40 * k)}" cy="${r1(cy - 16 * k)}" rx="${r1(56 * k)}" ry="${r1(26 * k)}"/><ellipse cx="${r1(cx + 30 * k)}" cy="${r1(cy - 22 * k)}" rx="${r1(64 * k)}" ry="${r1(30 * k)}"/></g>`);
    }
  }

  // Far tree line: overlapping canopies with the odd pine spire.
  for (let i = 0; i <= 44; i++) {
    const x = i * 28 + rnd() * 10 - 5, r = 18 + rnd() * 17, cy = 338 - rnd() * 14;
    add(`<circle cx="${r1(x)}" cy="${r1(cy)}" r="${r1(r)}" fill="${pick(s.farTrees)}"/>`);
    if (rnd() < 0.3) add(`<path d="M${r1(x - 9)} ${r1(cy - 8)} L${r1(x)} ${r1(cy - 50 - rnd() * 22)} L${r1(x + 9)} ${r1(cy - 8)}Z" fill="${s.spire}"/>`);
  }
  add(`<rect x="0" y="336" width="${W}" height="40" fill="${s.treeBand}"/>`);

  // Rolling ground, back to front.
  add(`<path d="M0 362 C200 326 400 352 600 342 S1000 314 1200 352 L1200 600 L0 600Z" fill="${s.ground[0]}"/>`);
  add(`<path d="M0 418 C250 378 500 430 750 398 S1100 378 1200 408 L1200 600 L0 600Z" fill="${s.ground[1]}"/>`);
  add(`<g clip-path="url(#fw)" opacity="${s.stripes}" fill="#fff">`);
  for (let i = -2; i < 16; i++) add(`<path d="M${i * 90} 600 L${i * 90 + 170} 370 L${i * 90 + 215} 370 L${i * 90 + 45} 600Z"/>`);
  add(`</g>`);

  // Tall pines: bare trunks with canopy high up. Drawn before the mid-ground shrubs.
  const pine = (x, top, base, k) => {
    add(`<rect x="${x - 3 * k}" y="${top + 30}" width="${6 * k}" height="${base - top - 30}" fill="#5a4632"/>`);
    for (let i = 0; i < 7; i++) {
      const cx = x + (rnd() - 0.5) * 80 * k, cy = top + rnd() * 70 * k, rx = (26 + rnd() * 26) * k, ry = (13 + rnd() * 10) * k;
      add(`<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${pick(s.pines)}"/>`);
    }
  };
  pine(86, 96, 446, 1.15); pine(178, 150, 440, 0.95); pine(1128, 88, 438, 1.15); pine(1036, 160, 432, 0.9); pine(292, 214, 420, 0.7); pine(948, 222, 412, 0.65);

  // Flowering bank: dark foliage with blossoms (or leaves, or berries) scattered over it.
  const shrub = (cx, cy, rx, ry, n, size) => {
    add(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.shrub[0]}"/>`);
    add(`<ellipse cx="${cx - rx * 0.25}" cy="${cy - ry * 0.2}" rx="${r1(rx * 0.7)}" ry="${r1(ry * 0.75)}" fill="${s.shrub[1]}"/>`);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.94;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d - ry * 0.12;
      add(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size * s.blossomSize * (0.55 + rnd() * 0.7))}" fill="${pick(s.blossoms)}"/>`);
    }
  };
  // mid-ground, under the pines and behind the green
  shrub(140, 438, 84, 20, 46, 4); shrub(1076, 426, 92, 22, 50, 4); shrub(300, 414, 46, 11, 20, 3); shrub(946, 406, 50, 11, 20, 3);

  // The green, bunkers and the flag.
  add(`<ellipse cx="610" cy="446" rx="48" ry="10" fill="${s.sand}"/><ellipse cx="906" cy="440" rx="40" ry="8" fill="${s.sand}"/>`);
  add(`<ellipse cx="760" cy="436" rx="124" ry="21" fill="${s.green[0]}"/><ellipse cx="760" cy="434" rx="106" ry="15" fill="${s.green[1]}"/>`);
  if (name === 'winter') {
    // Standing water on the green and fairway.
    add(`<g fill="#c9d7da" opacity=".8"><ellipse cx="706" cy="438" rx="22" ry="3.2"/><ellipse cx="826" cy="432" rx="16" ry="2.4"/><ellipse cx="470" cy="452" rx="30" ry="4"/><ellipse cx="1000" cy="450" rx="24" ry="3.4"/></g>`);
  }
  add(`<ellipse cx="771.5" cy="436" rx="7" ry="2.2" fill="#1f3d2c" opacity=".55"/>`);
  add(`<rect x="770" y="362" width="3.2" height="74" rx="1.2" fill="#f7f5ee"/>`);
  if (s.flag === 'wind') {
    // Stretched out and rippling.
    add(`<path d="M773.2 362 C786 358 796 368 812 364 L806 373 L814 383 C798 386 786 379 773.2 384Z" fill="#e9b940"/>`);
  } else {
    // No wind (or soaked): hanging against the pole.
    add(`<path d="M773.2 362 C780 364 787 364 791 366 C788 376 787 386 782 395 C778 392 775 390 773.2 390Z" fill="#e9b940"/>`);
  }

  // Creek across the front of the green.
  add(`<path d="M0 470 C200 454 380 494 600 476 S980 452 1200 478 L1200 504 C980 480 800 510 600 504 S200 484 0 500Z" fill="url(#water)"/>`);
  add(`<path d="M120 478 C220 472 300 486 380 486 M700 486 C800 480 900 470 1010 470" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>`);
  if (name === 'winter') {
    // Raindrops landing on the creek.
    for (let i = 0; i < 26; i++) {
      const x = 20 + fx() * 1160, y = 478 + fx() * 18;
      add(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(5 + fx() * 5)}" ry="1.6" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>`);
    }
  }

  // Front bank and the big drifts.
  add(`<path d="M0 512 C300 486 700 532 1200 496 L1200 600 L0 600Z" fill="${s.ground[2]}"/>`);
  shrub(76, 548, 128, 44, 100, 6.5); shrub(284, 574, 130, 36, 90, 6.5); shrub(1124, 540, 124, 46, 100, 6.5); shrub(934, 572, 140, 38, 94, 6.5); shrub(500, 592, 104, 24, 52, 5.5); shrub(716, 594, 112, 22, 52, 5.5);

  // Weather in front of everything.
  if (s.flag === 'wind') {
    // Gusts: soft white streaks ending in a curl, all blowing left to right.
    add(`<g fill="none" stroke="#fff" stroke-linecap="round" opacity=".7">`);
    for (const [x, y, len] of [[40, 230, 190], [380, 150, 230], [560, 300, 170], [820, 210, 210], [1010, 290, 150], [200, 390, 140], [640, 250, 120]]) {
      const w = len / 4;
      add(`<path d="M${x} ${y} C${x + w} ${y - 8} ${x + 2 * w} ${y + 8} ${x + 3 * w} ${y} S${x + len} ${y - 14} ${x + len - 12} ${y - 18} S${x + len - 26} ${y - 8} ${x + len - 14} ${y - 4}" stroke-width="2.2"/>`);
    }
    add(`</g>`);
    // Petals (spring) or leaves (autumn) caught in the wind.
    const bits = name === 'spring' ? ['#f08db5', '#f6b5cf', '#e2679a', '#ffffff'] : ['#d9822b', '#c05a2a', '#e8b13a', '#a8412a'];
    const n = name === 'spring' ? 46 : 40;
    for (let i = 0; i < n; i++) {
      const x = fx() * W, y = 110 + fx() * 400, rot = Math.round(fx() * 180);
      const rx = name === 'spring' ? 3 + fx() * 2 : 5 + fx() * 3;
      add(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(rx * 0.5)}" fill="${fxPick(bits)}" transform="rotate(${rot} ${r1(x)} ${r1(y)})"/>`);
    }
  }
  if (name === 'winter') {
    // Rain: slanted streaks that fade out towards the top, so the paper edge stays clean.
    add(`<g stroke="#7f949a" stroke-width="1.4" stroke-linecap="round">`);
    for (let i = 0; i < 230; i++) {
      const x = fx() * (W + 80) - 40, y = 70 + fx() * 520, len = 14 + fx() * 12;
      const op = Math.min(0.55, (y - 70) / 260);
      add(`<path d="M${r1(x)} ${r1(y)} l${r1(-len * 0.28)} ${r1(len)}" opacity="${op.toFixed(2)}"/>`);
    }
    add(`</g>`);
  }
  add(`</svg>`);
  return out.join('\n') + '\n';
}

fs.mkdirSync('public', { recursive: true });
for (const [name, palette] of Object.entries(SEASONS)) {
  const file = `public/golf-scene-${name}.svg`;
  fs.writeFileSync(file, build(name, palette));
  console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}

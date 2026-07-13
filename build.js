#!/usr/bin/env node
/**
 * build.js — regenerates index.html from the monthly data files.
 *
 * Inputs (committed to the repo):
 *   data/san.json   Santander rows  [name, daysCSV, region, flags]
 *   data/sco.json   Scotiabank rows [name, day, discNum, loc, subcat]
 *   data/bice.json  Bice rows       [name, daysCSV, disc, loc, cat]
 *   enrich.json     ratings cache   { "venue (normalised)": [rating, reviewCount, priceLevel] }
 *   web.json        website cache   { "venue (normalised)": "https://official-site" }
 *
 * Behaviour:
 *   - Validates the data (all three banks present, >=120 total) BEFORE touching index.html.
 *     A bad/half-scraped month exits non-zero, the CI job fails, and the last good
 *     index.html stays live. It never publishes garbage.
 *   - Injects the six data constants and stamps the current month.
 *   - Month label: env DATA_MONTH (e.g. "August 2026") if set, else current UTC month.
 */
const fs = require('fs');

const MIN_TOTAL = 120; // guardrail: below this we assume a broken scrape

function readJSON(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error(`FATAL: cannot read/parse ${f}: ${e.message}`); process.exit(1); }
}

const san  = readJSON('data/san.json');
const sco  = readJSON('data/sco.json');
const bice = readJSON('data/bice.json');
const rat  = readJSON('enrich.json');
const web  = readJSON('web.json');

// ---- validation (fail loudly, before writing anything) ----
const counts = { san: san.length, sco: sco.length, bice: bice.length };
const total = san.length + sco.length + bice.length;
const problems = [];
if (!Array.isArray(san) || !san.length)  problems.push('Santander feed empty');
if (!Array.isArray(sco) || !sco.length)  problems.push('Scotiabank feed empty');
if (!Array.isArray(bice) || !bice.length) problems.push('Bice feed empty');
if (total < MIN_TOTAL) problems.push(`total venues ${total} < ${MIN_TOTAL} threshold`);
if (problems.length) {
  console.error('VALIDATION FAILED — not publishing:\n - ' + problems.join('\n - '));
  console.error('Counts:', JSON.stringify(counts));
  process.exit(1);
}

// ---- month stamp ----
const MONTHS = ['January','February','March','April','May','June','July','August',
                'September','October','November','December'];
const now = new Date();
const label = process.env.DATA_MONTH || `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

// ---- inject into index.html (self-templating: replaces the six constants) ----
let html = fs.readFileSync('index.html', 'utf8');
function replace(re, value, name) {
  if (!re.test(html)) { console.error(`FATAL: marker for ${name} not found in index.html`); process.exit(1); }
  html = html.replace(re, value);
}
replace(/const SAN=[[\s\S]*?\];/,  'const SAN=' + JSON.stringify(san) + ';',  'SAN');
replace(/const SCO=[[\s\S]*?\];/,  'const SCO=' + JSON.stringify(sco) + ';',  'SCO');
replace(/const BICE=[[\s\S]*?\];/, 'const BICE=' + JSON.stringify(bice) + ';', 'BICE');
replace(/const RAT=\{[\s\S]*?\};/,    'const RAT=' + JSON.stringify(rat) + ';',   'RAT');
replace(/const WEB=\{[\s\S]*?\};/,    'const WEB=' + JSON.stringify(web) + ';',   'WEB');
replace(/const UPDATED="[^"]*";/,     'const UPDATED=' + JSON.stringify(label) + ';', 'UPDATED');

// ---- sanity: the injected script must still parse ----
try { new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]); }
catch (e) { console.error('FATAL: generated JS does not parse: ' + e.message); process.exit(1); }

fs.writeFileSync('index.html', html);
console.log(`OK — built index.html for "${label}"  (san ${counts.san}, sco ${counts.sco}, bice ${counts.bice}, total ${total}; ratings ${Object.keys(rat).length}, sites ${Object.keys(web).length})`);

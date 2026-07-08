import fs from 'fs';

const html = fs.readFileSync('Meeting Report/retirement_accumulation_v2.html', 'utf8');
const scripts = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g) || [];
const src = scripts.filter((s) => !/<script[^>]*\ssrc=/.test(s)).map((s) => s.replace(/<\/?script[^>]*>/g, '')).join('\n');

function ex(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('no ' + name);
  let d = 1, i = re.lastIndex;
  while (i < src.length && d > 0) {
    const c = src[i];
    if (c === '{') d++;
    else if (c === '}') d--;
    else if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === q) break; i++; } }
    else if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; }
    else if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; }
    i++;
  }
  return src.slice(m.index, i);
}

const fns = ['fmtR', 'escapeHtml', 'isFiniteNum', 'resolveMemberSlots', 'normalizeReviewBucket',
  'accountOwnerSlot', 'defaultAccountDecisions', 'aggregateReviewData', 'reviewMembers', 'reviewMemberRole',
  'reviewShortName', 'reviewPreferredName', 'reviewBucketLabel', 'fmtReviewPct', 'reviewWeightedPct',
  'reviewAccountsSummary', 'reviewTypeRank', 'reviewRetirementSubRank', 'reviewAccountGroups', 'reviewOwnerLabel',
  'renderReviewAccountRowsHtml', 'reviewNetWorthTotals', 'reviewNetWorthCategory'];

const fixture = JSON.parse(fs.readFileSync('fixtures/sample-household-review-data.json', 'utf8'));

const run = new Function('realData',
  'var reviewData=realData, reviewSlots=null, mappingDecisions={};' +
  fns.map(ex).join('\n') +
  ';reviewSlots=resolveMemberSlots(reviewData.clientFamily.members);' +
  'mappingDecisions=defaultAccountDecisions(reviewData.accounts, reviewSlots);' +
  'var t=aggregateReviewData(reviewData.accounts, mappingDecisions);' +
  'return { t:t, summary:reviewAccountsSummary(), nw:reviewNetWorthTotals(), groups:reviewAccountGroups(),' +
  ' slots:reviewSlots, acct:renderReviewAccountRowsHtml(),' +
  ' members:reviewMembers() };'
);
const r = run(fixture);

const R = (x) => Math.round(x);
console.log('=== slots ===');
console.log('A:', r.slots.A.firstName, '/', r.slots.A.role, '  B:', r.slots.B.firstName, '/', r.slots.B.role);
const kids = Object.values(r.slots.slotById).filter((s) => s === 'other').length;
console.log('children (other-slot):', kids);

console.log('\n=== aggregate (per spouse, raw floats) ===');
console.log('A.ret', r.t.A.ret, 'A.retC', r.t.A.retC, 'A.disc', r.t.A.disc, 'A.discC', r.t.A.discC);
console.log('B.ret', r.t.B.ret, 'B.retC', r.t.B.retC, 'B.disc', r.t.B.disc, 'B.discC', r.t.B.discC);
console.log('includedTotal', r.t.includedTotal, 'excludedTotal', r.t.excludedTotal);
const grand = fixture.accounts.reduce((s, a) => s + (a.value || 0), 0);
console.log('grand total (all account values)', grand);

console.log('\n=== reviewAccountsSummary (JS test golden numbers, whole rand) ===');
const s = r.summary;
['totalInvest', 'retTotal', 'discTotal', 'includedValue', 'excludedValue', 'includedMonthly', 'excludedMonthly'].forEach((k) => console.log(k, s[k]));
console.log('retTotal+discTotal===includedValue:', s.retTotal + s.discTotal === s.includedValue);
console.log('includedValue+excludedValue===totalInvest:', s.includedValue + s.excludedValue === s.totalInvest);

console.log('\n=== net worth ===');
console.log(JSON.stringify(r.nw));

console.log('\n=== accounts table structure ===');
const trs = (r.acct.match(/<tr/g) || []).length;
console.log('<tr> count:', trs);
console.log('owner groups:', r.groups.length, '(=> owner subtotal rows)');
console.log('>Ignore< count:', (r.acct.match(/>Ignore</g) || []).length);
console.log('includedValue formatted present in table:', r.acct.includes(fmtRfmt(s.includedValue)));
function fmtRfmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

console.log('\n=== per-owner account order (first group with >1 account) ===');
const multi = r.groups.find((g) => g.accounts.length > 1);
console.log('owner:', r.slots.A.firstName, '=> ', multi.accounts.map((a) => a.type + ':' + a.accountName).join('  |  '));

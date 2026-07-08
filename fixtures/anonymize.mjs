import fs from 'fs';

const SRC = 'john-reed-and-dianne-review-data-2026-07-07 (1).json';
const OUT = 'fixtures/sample-household-review-data.json';

const f = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// Deterministic fake identities, keyed by personId (order: primary, spouse, kids).
const SURNAME = 'Sample';
const FAKE = [
  { firstName: 'Alexander', preferredName: 'Alex' },
  { firstName: 'Robin', preferredName: 'Robin' },
  { firstName: 'Ella', preferredName: 'Ella' },
  { firstName: 'Max', preferredName: 'Max' },
  { firstName: 'Noah', preferredName: 'Noah' },
];
const byId = {};        // personId -> fake identity
const nameMap = {};     // realFullName / realFirst / realPreferred -> fake, for text scrubbing
f.clientFamily.members.forEach((m, i) => {
  const fake = FAKE[i] || { firstName: 'Person' + i, preferredName: 'P' + i };
  byId[m.personId] = { ...fake, lastName: SURNAME, ownerName: fake.firstName + ' ' + SURNAME };
  nameMap[m.firstName + ' ' + m.lastName] = fake.firstName + ' ' + SURNAME; // "John Reed Everitt"
  nameMap[m.firstName] = fake.firstName;                                     // "John Reed"
  if (m.preferredName) nameMap[m.preferredName] = fake.preferredName;        // "John"
});

// Also map the bare surname so "... Everitt" anywhere is caught.
nameMap[f.clientFamily.members[0].lastName] = SURNAME; // "Everitt" -> "Sample"
// Longest-first, word-boundary replacement so short keys (e.g. "Sam") can't
// corrupt substrings (e.g. the fake surname "Sample").
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RULES = Object.keys(nameMap)
  .sort((a, b) => b.length - a.length)
  .map((k) => [new RegExp('\\b' + esc(k) + '\\b', 'g'), nameMap[k]]);
function scrub(text) {
  if (text == null) return text;
  let t = String(text);
  for (const [re, rep] of RULES) t = t.replace(re, rep);
  return t;
}
// Deep-scrub every string in an object (safe: fake names contain no real-name words).
function deepScrub(o) {
  if (typeof o === 'string') return scrub(o);
  if (Array.isArray(o)) return o.map(deepScrub);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k of Object.keys(o)) r[k] = deepScrub(o[k]);
    return r;
  }
  return o;
}
const round = (v, step) => (v == null ? v : Math.round(v / step) * step);

// --- members: fake names, generic DOB (age preserved; the tool reads age, not dob)
const members = f.clientFamily.members.map((m) => {
  const fk = byId[m.personId];
  return {
    ...m,
    firstName: fk.firstName,
    preferredName: fk.preferredName,
    lastName: fk.lastName,
    dateOfBirth: null,
  };
});
const primary = byId[f.clientFamily.members[0].personId];
const spouse = byId[f.clientFamily.members[1].personId];

// --- accounts: fake ownerName, rounded value/contribution, everything else kept
const accounts = f.accounts.map((a) => ({
  ...a,
  ownerName: a.ownerPersonId ? byId[a.ownerPersonId].ownerName : a.ownerName,
  value: round(a.value, 1000),
  monthlyContribution: round(a.monthlyContribution, 100),
}));

// --- net-worth items: generic descriptions, rounded values
const NW_DESC = {
  business_interest: 'Business interest',
  debt: 'Home loan',
  primary_residence: 'Primary residence',
};
const netWorthItems = f.netWorthItems.map((n) => ({
  ...n,
  ownerName: n.ownerPersonId ? byId[n.ownerPersonId].ownerName : n.ownerName,
  description: NW_DESC[n.category] || 'Held-away item',
  institution: null,
  value: round(n.value, 1000),
}));

let out = {
  ...f,
  exportedBy: 'Advisor',
  clientFamily: {
    ...f.clientFamily,
    displayName: primary.preferredName + ' and ' + spouse.preferredName,
    members,
  },
  accounts,
  netWorthItems,
};
// Final pass: scrub any residual names anywhere (risk.policyBenefitRows,
// estate.willRows / powersOfAttorney / trusts, all comments). Word-boundary
// rules make this safe over the already-faked members/accounts.
out = deepScrub(out);

// --- Estate: fully control name-bearing free text (third parties like guardians
// or backup executors are NOT family members, so scrub misses them), and inject
// synthetic POA + a trust (the source client had none) so every estate section
// of the report is exercised by the fixture.
const mA = out.clientFamily.members[0], mB = out.clientFamily.members[1];
const full = (m) => m.firstName + ' ' + m.lastName;
if (Array.isArray(out.estate.willRows)) {
  out.estate.willRows.forEach((w, i) => {
    const isPrimary = w.personId === mA.personId;
    const other = isPrimary ? mB : mA;
    w.executor = other.preferredName;
    w.beneficiaryHeirs = other.preferredName + ', failing children';
    w.guardians = 'Nominated guardians';
    w.willStatus = i === 0 ? 'On file — unsigned' : 'Not discussed';
    w.testamentaryTrustForMinors = true;
  });
}
out.estate.powersOfAttorney = [
  { personId: mA.personId, name: full(mA), poaType: 'General', agent: mB.preferredName, status: 'On file — unsigned' },
  { personId: mB.personId, name: full(mB), poaType: 'General', agent: mA.preferredName, status: 'Not discussed' },
];
out.estate.trusts = [
  { name: 'Sample Family Trust', ownerName: 'Household', trustType: 'Inter vivos (living)', trustees: null },
];

// --- Risk: fake person/beneficiary names, drop policy numbers, round cover amounts.
if (Array.isArray(out.risk.policyBenefitRows)) {
  out.risk.policyBenefitRows.forEach((r) => {
    if (byId[r.personId]) r.personName = byId[r.personId].ownerName;
    r.beneficiary = (r.personId === mA.personId ? mB : mA).preferredName;
    r.policyNumber = null;
    for (const k of ['lifeCover', 'criticalIllness', 'capitalDisability', 'incomeDisabilityMonthly']) {
      if (typeof r[k] === 'number') r[k] = round(r[k], 1000);
    }
  });
}

fs.mkdirSync('fixtures', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', OUT);
console.log('household:', out.clientFamily.displayName);
console.log('members:', members.map((m) => m.preferredName + '/' + m.role).join(', '));
console.log('accounts:', accounts.length, '| netWorthItems:', netWorthItems.length);
console.log('projection.comments:', JSON.stringify(out.projection.comments));
console.log('schemaVersion:', out.schemaVersion);

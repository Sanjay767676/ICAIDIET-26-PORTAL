const fs = require('fs');
const path = require('path');

const submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_submissions.json'), 'utf-8'));
const authors = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_authors.json'), 'utf-8'));

console.log(`Total submissions: ${submissions.length}`);
console.log(`Total authors: ${authors.length}`);

// Group authors by submission_id
const subAuthorsMap = new Map();
authors.forEach(a => {
  if (!subAuthorsMap.has(a.submission_id)) {
    subAuthorsMap.set(a.submission_id, []);
  }
  subAuthorsMap.get(a.submission_id).push(a);
});

// Active vs deleted
const activeSubs = submissions.filter(s => !s.deleted_at);
const deletedSubs = submissions.filter(s => s.deleted_at);

console.log(`\n--- SUBMISSIONS SUMMARY ---`);
console.log(`Active submissions: ${activeSubs.length}`);
console.log(`Soft-deleted submissions: ${deletedSubs.length}`);

// Status breakdown
const statusMap = {};
activeSubs.forEach(s => {
  statusMap[s.status] = (statusMap[s.status] || 0) + 1;
});
console.log('Active submissions by status:', statusMap);

// Payment breakdown
console.log(`\n--- PAYMENT SUMMARY ---`);
const paidSubs = activeSubs.filter(s => s.payment_status === 'APPROVED');
const rejectedPaymentSubs = activeSubs.filter(s => s.payment_status === 'REJECTED');
const allWithPaymentSubmitted = activeSubs.filter(s => s.payment_submitted_at || s.payment_status);

console.log(`Payments Approved: ${paidSubs.length}`);
console.log(`Payments Rejected: ${rejectedPaymentSubs.length}`);
console.log(`Total with payment submitted: ${allWithPaymentSubmitted.length}`);

// Payment revenue & types
let totalINR = 0;
let totalUSD = 0;
const regTypeCount = {};
const authorTypeCount = {};
const feeAmountCount = {};

paidSubs.forEach(s => {
  const reg = s.registration_type || 'Unspecified';
  const auth = s.author_type || 'Unspecified';
  regTypeCount[reg] = (regTypeCount[reg] || 0) + 1;
  authorTypeCount[auth] = (authorTypeCount[auth] || 0) + 1;
  const fee = s.fee_amount || 'None';
  feeAmountCount[fee] = (feeAmountCount[fee] || 0) + 1;

  if (s.fee_amount) {
    const str = s.fee_amount.trim();
    const val = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    if (str.includes('$')) totalUSD += val;
    else totalINR += val;
  }
});

console.log('Approved Payments by Registration Type:', regTypeCount);
console.log('Approved Payments by Author Type:', authorTypeCount);
console.log('Approved Payments by Fee Tier/Amount:', feeAmountCount);
console.log(`Total Approved Revenue: ₹${totalINR.toLocaleString('en-IN')} INR | $${totalUSD} USD`);

// Colleges and Country & State Analysis
console.log(`\n--- COLLEGE & LOCATION EXTRACTION ---`);

// Helper to inspect colleges of all active submissions
const subColleges = [];
activeSubs.forEach(sub => {
  const auths = subAuthorsMap.get(sub.id) || [];
  const primary = auths.find(a => a.is_primary === 1) || auths[0];
  const allColleges = auths.map(a => a.college).filter(Boolean);
  const primaryCollege = primary ? (primary.college || '') : '';
  const phones = auths.map(a => a.phone).filter(Boolean);
  const emails = auths.map(a => a.email).filter(Boolean);

  subColleges.push({
    subId: sub.id,
    code: sub.submission_code,
    paperId: sub.paper_id,
    title: sub.title,
    status: sub.status,
    payment_status: sub.payment_status,
    author_type: sub.author_type,
    registration_type: sub.registration_type,
    primaryCollege,
    allColleges: Array.from(new Set(allColleges)),
    phones,
    emails
  });
});

fs.writeFileSync(path.join(__dirname, 'analyzed_sub_colleges.json'), JSON.stringify(subColleges, null, 2));
console.log(`Saved ${subColleges.length} submissions with college info to analyzed_sub_colleges.json`);

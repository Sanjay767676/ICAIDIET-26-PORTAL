const fs = require('fs');
const path = require('path');

const subColleges = JSON.parse(fs.readFileSync(path.join(__dirname, 'analyzed_sub_colleges.json'), 'utf-8'));
const authors = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_authors.json'), 'utf-8'));
const submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_submissions.json'), 'utf-8'));

// Unique primary colleges
const collegeMap = {};
subColleges.forEach(s => {
  const c = (s.primaryCollege || 'Unknown').trim();
  collegeMap[c] = (collegeMap[c] || 0) + 1;
});

const sortedColleges = Object.entries(collegeMap).sort((a, b) => b[1] - a[1]);
console.log(`Distinct primary college strings: ${sortedColleges.length}`);
console.log('Top 30 raw college strings:');
sortedColleges.slice(0, 30).forEach(([name, count]) => {
  console.log(`  ${count}: "${name}"`);
});

// Check for foreign indicators in emails, phones, college names
const foreignCandidates = [];
subColleges.forEach(s => {
  const colText = (s.primaryCollege + ' ' + s.allColleges.join(' ')).toLowerCase();
  const phoneText = s.phones.join(' ');
  const emailText = s.emails.join(' ');

  let isForeign = false;
  let reason = [];

  // Check foreign domains or extensions
  // (Note: .edu is often US or other countries, but sometimes Indian colleges use .edu.in)
  const nonInDomains = s.emails.filter(e => {
    const domain = e.split('@')[1] || '';
    return !domain.endsWith('.in') && !domain.endsWith('.com') && !domain.endsWith('.net') && !domain.endsWith('.org');
  });
  if (nonInDomains.length > 0) {
    reason.push(`Domain: ${nonInDomains.join(', ')}`);
  }

  // Check phone codes
  s.phones.forEach(p => {
    const cleaned = p.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+') && !cleaned.startsWith('+91')) {
      isForeign = true;
      reason.push(`Phone: ${p}`);
    } else if (cleaned.length < 10 || (cleaned.length > 10 && !cleaned.startsWith('91') && !cleaned.startsWith('0'))) {
      // Possible foreign number without +
      if (!cleaned.startsWith('91') && cleaned.length >= 11) {
        reason.push(`Odd phone: ${p}`);
      }
    }
  });

  // Check keywords in college
  const foreignKeywords = [
    'university of', 'institute of technology', 'college'
  ]; // we need specific foreign country/city names
  const foreignLocs = [
    'usa', 'uk', 'united states', 'united kingdom', 'malaysia', 'singapore', 'germany', 'australia',
    'canada', 'uae', 'dubai', 'oman', 'saudi', 'nigeria', 'ethiopia', 'egypt', 'china', 'japan',
    'vietnam', 'philippines', 'bangladesh', 'sri lanka', 'nepal', 'pakistan', 'kenya', 'south africa',
    'france', 'italy', 'spain', 'russia', 'brazil', 'mexico', 'indonesia', 'thailand', 'taiwan', 'korea'
  ];
  for (const loc of foreignLocs) {
    const regex = new RegExp(`\\b${loc}\\b`, 'i');
    if (regex.test(colText)) {
      isForeign = true;
      reason.push(`Location keyword: ${loc} in "${colText}"`);
    }
  }

  if (isForeign || reason.length > 0) {
    foreignCandidates.push({
      subId: s.subId,
      code: s.code,
      title: s.title,
      colleges: s.allColleges,
      phones: s.phones,
      emails: s.emails,
      reason
    });
  }
});

console.log(`\nPotential foreign / unusual entries found: ${foreignCandidates.length}`);
foreignCandidates.forEach((fc, idx) => {
  console.log(`\n#${idx + 1} Code: ${fc.code} | Title: "${fc.title.slice(0, 50)}..."`);
  console.log(`   Colleges: ${JSON.stringify(fc.colleges)}`);
  console.log(`   Phones: ${JSON.stringify(fc.phones)}`);
  console.log(`   Emails: ${JSON.stringify(fc.emails)}`);
  console.log(`   Reasons: ${fc.reason.join('; ')}`);
});

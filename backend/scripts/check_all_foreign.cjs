const fs = require('fs');
const path = require('path');

const submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_submissions.json'), 'utf-8'));
const authors = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_authors.json'), 'utf-8'));

const subAuthorsMap = new Map();
authors.forEach(a => {
  if (!subAuthorsMap.has(a.submission_id)) subAuthorsMap.set(a.submission_id, []);
  subAuthorsMap.get(a.submission_id).push(a);
});

console.log('--- ALL SUBMISSIONS FOREIGN CHECK ---');

const results = [];

submissions.forEach(sub => {
  const auths = subAuthorsMap.get(sub.id) || [];
  const primary = auths.find(a => a.is_primary === 1) || auths[0];
  const allColleges = auths.map(a => a.college || '').join(' | ');
  const allEmails = auths.map(a => a.email || '').join(' | ');
  const allPhones = auths.map(a => a.phone || '').join(' | ');

  // Check country signals
  const combined = (allColleges + ' ' + allEmails + ' ' + (sub.title || '')).toLowerCase();

  // Distinct foreign indicators
  const indicators = [];
  
  if (sub.author_type && sub.author_type.toLowerCase().includes('foreign')) {
    indicators.push(`AuthorType: ${sub.author_type}`);
  }

  // Country names (avoid words like 'india', 'indian')
  const countries = [
    'malaysia', 'singapore', 'usa', 'united states', 'uk', 'united kingdom', 'nigeria', 'ethiopia',
    'saudi', 'uae', 'dubai', 'oman', 'qatar', 'kuwait', 'germany', 'france', 'australia', 'canada',
    'china', 'japan', 'korea', 'vietnam', 'philippines', 'indonesia', 'sri lanka', 'bangladesh',
    'nepal', 'bhutan', 'kenya', 'south africa', 'egypt', 'ghana', 'iraq', 'iran', 'turkey', 'italy',
    'spain', 'russia', 'sweden', 'norway', 'netherlands', 'switzerland', 'ireland', 'new zealand'
  ];

  for (const c of countries) {
    const reg = new RegExp(`\\b${c}\\b`, 'i');
    if (reg.test(allColleges)) {
      indicators.push(`College mentions ${c}`);
    }
  }

  // Check non-Indian email TLDs (.edu.my, .edu.ng, .ac.uk, .edu, etc.)
  auths.forEach(a => {
    const email = (a.email || '').toLowerCase();
    const parts = email.split('@');
    if (parts.length === 2) {
      const domain = parts[1];
      if (domain.endsWith('.my') || domain.endsWith('.ng') || domain.endsWith('.ae') || 
          domain.endsWith('.us') || domain.endsWith('.uk') || domain.endsWith('.au') ||
          domain.endsWith('.ca') || domain.endsWith('.sg') || domain.endsWith('.sa') ||
          domain.endsWith('.bd') || domain.endsWith('.np') || domain.endsWith('.lk') ||
          domain.endsWith('.de') || domain.endsWith('.fr') || domain.endsWith('.jp') ||
          domain.endsWith('.cn') || domain.endsWith('.za') || domain.endsWith('.ke')) {
        indicators.push(`Foreign email domain: ${domain}`);
      }
    }
  });

  // Check international phone numbers
  auths.forEach(a => {
    const p = (a.phone || '').trim();
    if (p.startsWith('+') && !p.startsWith('+91')) {
      indicators.push(`Intl phone: ${p}`);
    }
  });

  if (indicators.length > 0) {
    results.push({
      subId: sub.id,
      code: sub.submission_code,
      paperId: sub.paper_id,
      title: sub.title,
      status: sub.status,
      deleted: !!sub.deleted_at,
      payment_status: sub.payment_status,
      author_type: sub.author_type,
      registration_type: sub.registration_type,
      primaryCollege: primary ? primary.college : '',
      allColleges,
      allEmails,
      allPhones,
      indicators
    });
  }
});

console.log(`Found ${results.length} foreign-related submissions:\n`);
results.forEach((r, i) => {
  console.log(`[#${i+1}] ${r.code} (${r.paperId || 'no paper_id'}) - ${r.title}`);
  console.log(`     Active: ${!r.deleted} | Status: ${r.status} | Payment: ${r.payment_status || 'None'}`);
  console.log(`     Colleges: ${r.allColleges}`);
  console.log(`     Emails: ${r.allEmails}`);
  console.log(`     Indicators: ${r.indicators.join(', ')}`);
  console.log('');
});

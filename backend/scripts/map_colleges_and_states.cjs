const fs = require('fs');
const path = require('path');

const submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_submissions.json'), 'utf-8'));
const authors = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_authors.json'), 'utf-8'));

const subAuthorsMap = new Map();
authors.forEach(a => {
  if (!subAuthorsMap.has(a.submission_id)) subAuthorsMap.set(a.submission_id, []);
  subAuthorsMap.get(a.submission_id).push(a);
});

const activeSubs = submissions.filter(s => !s.deleted_at);

// Map distinct colleges
const distinctColleges = new Map();

activeSubs.forEach(sub => {
  const auths = subAuthorsMap.get(sub.id) || [];
  const primary = auths.find(a => a.is_primary === 1) || auths[0];
  const college = (primary && primary.college ? primary.college : 'Unknown').trim();
  
  if (!distinctColleges.has(college)) {
    distinctColleges.set(college, {
      rawName: college,
      submissionsCount: 0,
      paidCount: 0,
      subIds: []
    });
  }
  const entry = distinctColleges.get(college);
  entry.submissionsCount++;
  if (sub.payment_status === 'APPROVED') entry.paidCount++;
  entry.subIds.push(sub.submission_code);
});

const sorted = Array.from(distinctColleges.values()).sort((a, b) => b.submissionsCount - a.submissionsCount);

console.log(`Total active submissions: ${activeSubs.length}`);
console.log(`Total distinct primary college strings: ${sorted.length}\n`);

sorted.forEach((c, idx) => {
  console.log(`${idx + 1}. [${c.submissionsCount} subs, ${c.paidCount} paid] "${c.rawName}"`);
});

fs.writeFileSync(path.join(__dirname, 'distinct_colleges.json'), JSON.stringify(sorted, null, 2));

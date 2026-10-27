const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fetching submissions from remote D1...');
const subCmd = 'npx wrangler d1 execute icaidiet_text_records --remote --json --command="SELECT id, submission_code, paper_id, title, status, track, author_name, author_email, registration_type, author_type, fee_amount, fee_tier, payment_status, payment_submitted_at, payment_approved_at, deleted_at, created_at FROM submissions;"';
const subRaw = execSync(subCmd, { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
const subJson = JSON.parse(subRaw);
const submissions = subJson[0].results;
console.log(`Fetched ${submissions.length} submissions.`);

console.log('Fetching authors from remote D1...');
const authCmd = 'npx wrangler d1 execute icaidiet_text_records --remote --json --command="SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college FROM authors;"';
const authRaw = execSync(authCmd, { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
const authJson = JSON.parse(authRaw);
const authors = authJson[0].results;
console.log(`Fetched ${authors.length} authors.`);

fs.writeFileSync(path.join(__dirname, 'dump_submissions.json'), JSON.stringify(submissions, null, 2));
fs.writeFileSync(path.join(__dirname, 'dump_authors.json'), JSON.stringify(authors, null, 2));
console.log('Data saved to dump_submissions.json and dump_authors.json');

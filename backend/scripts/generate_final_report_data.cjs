const fs = require('fs');
const path = require('path');

const submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_submissions.json'), 'utf-8'));
const authors = JSON.parse(fs.readFileSync(path.join(__dirname, 'dump_authors.json'), 'utf-8'));

const subAuthorsMap = new Map();
authors.forEach(a => {
  if (!subAuthorsMap.has(a.submission_id)) subAuthorsMap.set(a.submission_id, []);
  subAuthorsMap.get(a.submission_id).push(a);
});

function resolveCollegeAndState(raw) {
  const s = (raw || 'Unknown').trim().replace(/\s+/g, ' ');
  const lower = s.toLowerCase();

  // 1. Foreign
  if (lower.includes('lincoln university') || lower.includes('malaysia')) {
    return { college: 'Lincoln University College', state: 'International (Malaysia)', city: 'Petaling Jaya', country: 'Malaysia' };
  }

  // 2. Tamil Nadu
  if (lower.includes('kongu engineering') || lower.includes('kongu engg')) {
    return { college: 'Kongu Engineering College', state: 'Tamil Nadu', city: 'Perundurai/Erode', country: 'India' };
  }
  if (lower.includes('sri krishna college of engineering') || lower.includes('skcet')) {
    return { college: 'Sri Krishna College of Engineering and Technology (SKCET)', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri krishna college of technology') || lower.includes('skct')) {
    return { college: 'Sri Krishna College of Technology (SKCT)', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('kalaignar') || lower.includes('kalaingarkarunanidhi') || lower.includes('kalaignarkarunanithi') || lower.includes('kit-kalaignar') || lower.includes('kit - kalaignar') || lower.includes('kit–kalaignar') || lower.includes('kit _ kalaignar') || lower.includes('kit kalaignar')) {
    return { college: 'KIT - Kalaignarkarunanidhi Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sns college of technology') || lower.includes('snsct')) {
    return { college: 'SNS College of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sns college of engineering') || lower.includes('snsce')) {
    return { college: 'SNS College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('n.g.p') || lower.includes('ngp') || lower.includes('n. g. p.')) {
    return { college: 'Dr. N.G.P. Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('kpr institute') || lower.includes('kpriet')) {
    return { college: 'KPR Institute of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('kumaraguru') || lower.includes('kct')) {
    return { college: 'Kumaraguru College of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri ramakrishna engineering college') || lower.includes('srec')) {
    return { college: 'Sri Ramakrishna Engineering College', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri ramakrishna institute of technology') || lower.includes('srit')) {
    return { college: 'Sri Ramakrishna Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri ramakrishna college of arts and science')) {
    return { college: 'Sri Ramakrishna College of Arts and Science', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri eshwar') || lower.includes('sece')) {
    return { college: 'Sri Eshwar College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri shakthi')) {
    return { college: 'Sri Shakthi Institute of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('hindustan institute of technology and science') || lower.includes('hits')) {
    return { college: 'Hindustan Institute of Technology and Science (HITS)', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('hindusthan') || lower.includes('hindustan college')) {
    return { college: 'Hindusthan College of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('karpagam college of engineering')) {
    return { college: 'Karpagam College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('karpagam institute of technology')) {
    return { college: 'Karpagam Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('karpagam academy') || lower.includes('karpagam')) {
    return { college: 'Karpagam Institutions', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('karunya')) {
    return { college: 'Karunya Institute of Technology and Sciences', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('kgisl')) {
    return { college: 'KGISL Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('kg college of arts and science')) {
    return { college: 'KG College of Arts and Science', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('mahalingam') || lower.includes('mcet')) {
    return { college: 'Dr. Mahalingam College of Engineering and Technology', state: 'Tamil Nadu', city: 'Pollachi/Coimbatore', country: 'India' };
  }
  if (lower.includes('bannari amman')) {
    return { college: 'Bannari Amman Institute of Technology', state: 'Tamil Nadu', city: 'Sathyamangalam/Erode', country: 'India' };
  }
  if (lower.includes('adithya institute')) {
    return { college: 'Adithya Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('akshaya college')) {
    return { college: 'Akshaya College of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('govt. college of technology') || lower.includes('government college of technology') || lower.includes('gct')) {
    return { college: 'Government College of Technology (GCT)', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('sri sai ranganthan') || lower.includes('sri sai ranganathan')) {
    return { college: 'Sri Sai Ranganathan Engineering College', state: 'Tamil Nadu', city: 'Coimbatore', country: 'India' };
  }
  if (lower.includes('csi college of engineering')) {
    return { college: 'CSI College of Engineering', state: 'Tamil Nadu', city: 'Ketti/Nilgiris', country: 'India' };
  }
  if (lower.includes('nandha')) {
    return { college: 'Nandha College of Technology / Engineering', state: 'Tamil Nadu', city: 'Erode', country: 'India' };
  }
  if (lower.includes('erode sengunthar')) {
    return { college: 'Erode Sengunthar Engineering College', state: 'Tamil Nadu', city: 'Erode', country: 'India' };
  }
  if (lower.includes('k.s. rangasamy') || lower.includes('ksr')) {
    return { college: 'K.S. Rangasamy College of Technology', state: 'Tamil Nadu', city: 'Tiruchengode/Namakkal', country: 'India' };
  }
  if (lower.includes('mahendra')) {
    return { college: 'Mahendra Institute of Technology / Engineering', state: 'Tamil Nadu', city: 'Namakkal/Salem', country: 'India' };
  }
  if (lower.includes('m kumarasamy') || lower.includes('kumarasamy')) {
    return { college: 'M. Kumarasamy College of Engineering', state: 'Tamil Nadu', city: 'Karur', country: 'India' };
  }
  if (lower.includes('sona college')) {
    return { college: 'Sona College of Technology', state: 'Tamil Nadu', city: 'Salem', country: 'India' };
  }
  if (lower.includes('chennai institute of technology') || lower.includes('chennai insitute')) {
    return { college: 'Chennai Institute of Technology', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes("st. joseph's college of engineering") || lower.includes("st joseph's college of engineering") || lower.includes("st.joseph's college of engineering")) {
    return { college: "St. Joseph's College of Engineering", state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes("st. joseph's institute of technology") || lower.includes("st joseph's institute of technology") || lower.includes("st. joseph's institute of technology,omr")) {
    return { college: "St. Joseph's Institute of Technology", state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('saveetha')) {
    return { college: 'Saveetha Engineering College / SIMATS', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('rajalakshmi')) {
    return { college: 'Rajalakshmi Engineering College', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('sathyabama')) {
    return { college: 'Sathyabama Institute of Science and Technology', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('vel tech') || lower.includes('veltech')) {
    return { college: 'Vel Tech Rangarajan Dr. Sagunthala R&D Institute', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('panimalar')) {
    return { college: 'Panimalar Engineering College', state: 'Tamil Nadu', city: 'Chennai', country: 'India' };
  }
  if (lower.includes('prathyusha')) {
    return { college: 'Prathyusha Engineering College', state: 'Tamil Nadu', city: 'Tiruvallur/Chennai', country: 'India' };
  }
  if (lower.includes('r.m.d') || lower.includes('rmd')) {
    return { college: 'R.M.D Engineering College', state: 'Tamil Nadu', city: 'Kavaraipettai/Chennai', country: 'India' };
  }
  if (lower.includes('karpaga vinayaga')) {
    return { college: 'Karpaga Vinayaga College of Engineering and Technology', state: 'Tamil Nadu', city: 'Chengalpattu', country: 'India' };
  }
  if (lower.includes('srm institute') || lower.includes('srm university') || lower.includes('srmist') || lower.includes('srm')) {
    return { college: 'SRM Institute of Science and Technology (SRMIST)', state: 'Tamil Nadu', city: 'Kattankulathur/Trichy', country: 'India' };
  }
  if (lower.includes('takshashila')) {
    return { college: 'Takshashila University', state: 'Tamil Nadu', city: 'Tindivanam/Villupuram', country: 'India' };
  }
  if (lower.includes('thiagarajar')) {
    return { college: 'Thiagarajar College of Engineering / Arts', state: 'Tamil Nadu', city: 'Madurai', country: 'India' };
  }
  if (lower.includes('velammal')) {
    return { college: 'Velammal College of Engineering and Technology', state: 'Tamil Nadu', city: 'Madurai/Chennai', country: 'India' };
  }
  if (lower.includes('mepco')) {
    return { college: 'Mepco Schlenk Engineering College', state: 'Tamil Nadu', city: 'Sivakasi', country: 'India' };
  }
  if (lower.includes('p.s.r') || lower.includes('psr')) {
    return { college: 'P.S.R. Engineering College', state: 'Tamil Nadu', city: 'Sivakasi', country: 'India' };
  }
  if (lower.includes('skp engineering') || lower.includes('skp')) {
    return { college: 'SKP Engineering College', state: 'Tamil Nadu', city: 'Tiruvannamalai', country: 'India' };
  }
  if (lower.includes('mailam')) {
    return { college: 'Mailam Engineering College', state: 'Tamil Nadu', city: 'Villupuram', country: 'India' };
  }
  if (lower.includes('l.r.g') || lower.includes('lrg')) {
    return { college: 'L.R.G. Government Arts College for Women', state: 'Tamil Nadu', city: 'Tirupur', country: 'India' };
  }
  if (lower.includes('vinayaka mission')) {
    return { college: 'Vinayaka Missions Research Foundation', state: 'Tamil Nadu', city: 'Salem/Chennai', country: 'India' };
  }

  // 3. Maharashtra
  if (lower.includes('vishwakarma') || lower.includes('vit pune') || (lower.includes('vit') && lower.includes('pune'))) {
    return { college: 'Vishwakarma Institute of Technology (VIT Pune)', state: 'Maharashtra', city: 'Pune', country: 'India' };
  }
  if (lower.includes('sanjivani')) {
    return { college: 'Sanjivani College of Engineering', state: 'Maharashtra', city: 'Kopargaon', country: 'India' };
  }

  // 4. Karnataka
  if (lower.includes('presidency university')) {
    return { college: 'Presidency University', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('dayananda sagar')) {
    return { college: 'Dayananda Sagar University', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('visvesvaraya') || lower.includes('sir mvit')) {
    return { college: 'Sir M. Visvesvaraya Institute of Technology', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('bms institute') || lower.includes('bmsit')) {
    return { college: 'BMS Institute of Technology and Management', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('b.m.s.college of engineering') || lower.includes('bmsce')) {
    return { college: 'B.M.S. College of Engineering', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('new horizon')) {
    return { college: 'New Horizon College of Engineering', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('cmr university')) {
    return { college: 'CMR University', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('welingkar')) {
    return { college: 'Prin. L.N. Welingkar Institute (WeSchool)', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('kristu jayanti')) {
    return { college: 'Kristu Jayanti College', state: 'Karnataka', city: 'Bengaluru', country: 'India' };
  }
  if (lower.includes('sahyadri')) {
    return { college: 'Sahyadri College of Engineering & Management', state: 'Karnataka', city: 'Mangaluru', country: 'India' };
  }

  // 5. Telangana & Andhra Pradesh
  if (lower.includes('b v raju') || lower.includes('bvrit')) {
    return { college: 'B V Raju Institute of Technology (BVRIT)', state: 'Telangana', city: 'Narsapur/Hyderabad', country: 'India' };
  }
  if (lower.includes('kakinada') || lower.includes('jntuk')) {
    return { college: 'University College of Engineering Kakinada, JNTUK', state: 'Andhra Pradesh', city: 'Kakinada', country: 'India' };
  }
  if (lower.includes('vignan')) {
    return { college: "Vignan's Foundation for Science, Technology & Research", state: 'Andhra Pradesh', city: 'Guntur', country: 'India' };
  }
  if (lower.includes('madanapalle') || lower.includes('mits')) {
    return { college: 'Madanapalle Institute of Technology & Science', state: 'Andhra Pradesh', city: 'Madanapalle', country: 'India' };
  }
  if (lower.includes('velagapudi') || lower.includes('vrsec')) {
    return { college: 'Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)', state: 'Andhra Pradesh', city: 'Vijayawada', country: 'India' };
  }
  if (lower.includes('rajiv gandhi university of knowledge technologies') || lower.includes('rk valley') || lower.includes('rgukt')) {
    return { college: 'Rajiv Gandhi University of Knowledge Technologies (RGUKT IIIT RK Valley)', state: 'Andhra Pradesh', city: 'Kadapa', country: 'India' };
  }

  // 6. Kerala
  if (lower.includes('nehru college of engineering and research centre')) {
    return { college: 'Nehru College of Engineering and Research Centre', state: 'Kerala', city: 'Thrissur/Palakkad', country: 'India' };
  }
  if (lower.includes('jyothi engineering')) {
    return { college: 'Jyothi Engineering College', state: 'Kerala', city: 'Cheruthuruthy/Thrissur', country: 'India' };
  }
  if (lower.includes('marian engineering')) {
    return { college: 'Marian Engineering College', state: 'Kerala', city: 'Trivandrum', country: 'India' };
  }

  // 7. Uttar Pradesh & Delhi
  if (lower.includes('vivekananda college of technology and management') || lower.includes('aligarh')) {
    return { college: 'Vivekananda College of Technology and Management', state: 'Uttar Pradesh', city: 'Aligarh', country: 'India' };
  }
  if (lower.includes('jamia hamdard')) {
    return { college: 'Jamia Hamdard', state: 'Delhi', city: 'New Delhi', country: 'India' };
  }

  // 8. Gujarat
  if (lower.includes('karnavati university') || lower.includes('uslm')) {
    return { college: 'Karnavati University (USLM)', state: 'Gujarat', city: 'Gandhinagar', country: 'India' };
  }

  return { college: s, state: 'Other / Unspecified', city: 'Unknown', country: 'India' };
}

const activeSubs = submissions.filter(s => !s.deleted_at);

// State Aggregations
const stateStats = {};
const collegeStats = {};
const countryStats = { India: 0, Foreign: 0 };

activeSubs.forEach(sub => {
  const auths = subAuthorsMap.get(sub.id) || [];
  const primary = auths.find(a => a.is_primary === 1) || auths[0];
  const rawCollege = primary ? primary.college : '';
  const geo = resolveCollegeAndState(rawCollege);

  const isPaid = sub.payment_status === 'APPROVED';

  // Country
  if (geo.country === 'Malaysia' || geo.state.startsWith('International')) {
    countryStats.Foreign++;
  } else {
    countryStats.India++;
  }

  // State
  if (!stateStats[geo.state]) {
    stateStats[geo.state] = { submissions: 0, paid: 0, colleges: new Set() };
  }
  stateStats[geo.state].submissions++;
  if (isPaid) stateStats[geo.state].paid++;
  stateStats[geo.state].colleges.add(geo.college);

  // College
  if (!collegeStats[geo.college]) {
    collegeStats[geo.college] = {
      college: geo.college,
      state: geo.state,
      city: geo.city,
      submissions: 0,
      paid: 0,
      subCodes: []
    };
  }
  collegeStats[geo.college].submissions++;
  if (isPaid) collegeStats[geo.college].paid++;
  collegeStats[geo.college].subCodes.push(sub.submission_code);
});

console.log('=====================================================');
console.log('              ICAIDIET\'26 DATABASE METRICS           ');
console.log('=====================================================');

console.log(`\n1. SUBMISSION TOTALS:`);
console.log(`   - Total Submissions in Database: ${submissions.length}`);
console.log(`   - Active Submissions: ${activeSubs.length}`);
console.log(`   - Soft-Deleted Submissions: ${submissions.length - activeSubs.length}`);

console.log(`\n2. ACTIVE SUBMISSION STATUSES:`);
const statuses = {};
activeSubs.forEach(s => statuses[s.status] = (statuses[s.status] || 0) + 1);
console.log(`   - Ready for Registration (Accepted): ${statuses.READY_FOR_REGISTRATION || 0}`);
console.log(`   - Under Review: ${statuses.UNDER_REVIEW || 0}`);
console.log(`   - Submitted: ${statuses.SUBMITTED || 0}`);

console.log(`\n3. PAYMENT STATUS:`);
const paidSubs = activeSubs.filter(s => s.payment_status === 'APPROVED');
console.log(`   - Total Payments Approved: ${paidSubs.length}`);
console.log(`   - Total Payments Rejected: ${activeSubs.filter(s => s.payment_status === 'REJECTED').length}`);
console.log(`   - Total Payments Submitted: ${activeSubs.filter(s => s.payment_submitted_at || s.payment_status).length}`);

let totalINR = 0;
const feeBreakdown = {};
paidSubs.forEach(s => {
  const f = s.fee_amount || 'Unspecified';
  feeBreakdown[f] = (feeBreakdown[f] || 0) + 1;
  const num = parseFloat((s.fee_amount || '').replace(/[^0-9.]/g, '')) || 0;
  totalINR += num;
});
console.log(`   - Total Approved Fee Amount: ₹${totalINR.toLocaleString('en-IN')}`);
console.log(`   - Fee Breakdown:`, feeBreakdown);

console.log(`\n4. COUNTRY BREAKDOWN:`);
console.log(`   - India Entries: ${countryStats.India} (${((countryStats.India / activeSubs.length) * 100).toFixed(1)}%)`);
console.log(`   - Foreign Entries: ${countryStats.Foreign} (${((countryStats.Foreign / activeSubs.length) * 100).toFixed(2)}%)`);

console.log(`\n5. STATE-WISE SUBMISSIONS RANKING:`);
const sortedStates = Object.entries(stateStats).sort((a, b) => b[1].submissions - a[1].submissions);
sortedStates.forEach(([st, d], idx) => {
  const pct = ((d.submissions / activeSubs.length) * 100).toFixed(1);
  console.log(`   ${idx + 1}. ${st}: ${d.submissions} submissions (${pct}%), ${d.paid} paid, ${d.colleges.size} distinct institutions`);
});

console.log(`\n6. TOP COLLEGES BY SUBMISSIONS:`);
const sortedColleges = Object.values(collegeStats).sort((a, b) => b.submissions - a.submissions);
sortedColleges.slice(0, 25).forEach((c, idx) => {
  console.log(`   ${idx + 1}. ${c.college} (${c.city}, ${c.state}): ${c.submissions} submissions, ${c.paid} paid`);
});

console.log(`\n7. TOP COLLEGES BY PAID PAPERS:`);
const sortedPaidColleges = Object.values(collegeStats).sort((a, b) => b.paid - a.paid);
sortedPaidColleges.slice(0, 20).forEach((c, idx) => {
  console.log(`   ${idx + 1}. ${c.college} (${c.city}, ${c.state}): ${c.paid} paid / ${c.submissions} submitted`);
});

fs.writeFileSync(path.join(__dirname, 'final_report_data.json'), JSON.stringify({
  summary: {
    totalDbSubmissions: submissions.length,
    activeSubmissions: activeSubs.length,
    softDeletedSubmissions: submissions.length - activeSubs.length,
    approvedPayments: paidSubs.length,
    totalRevenueINR: totalINR,
    countryStats,
  },
  stateStats: sortedStates.map(([st, d]) => ({ state: st, submissions: d.submissions, paid: d.paid, institutionCount: d.colleges.size })),
  collegeStats: sortedColleges
}, null, 2));
console.log('\nReport data written to final_report_data.json');

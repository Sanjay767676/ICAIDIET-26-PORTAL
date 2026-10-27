const fs = require('fs');
const path = require('path');

const distinct = JSON.parse(fs.readFileSync(path.join(__dirname, 'distinct_colleges.json'), 'utf-8'));

function resolveCollegeAndState(raw) {
  const s = raw.trim();
  const lower = s.toLowerCase();

  // 1. Foreign
  if (lower.includes('lincoln university') || lower.includes('malaysia')) {
    return { college: 'Lincoln University College', state: 'International (Malaysia)', city: 'Petaling Jaya', country: 'Malaysia' };
  }

  // 2. Tamil Nadu
  if (lower.includes('kongu engineering') || lower.includes('kongu engg')) {
    return { college: 'Kongu Engineering College', state: 'Tamil Nadu', city: 'Perundurai/Erode' };
  }
  if (lower.includes('sri krishna college of engineering') || lower.includes('skcet')) {
    return { college: 'Sri Krishna College of Engineering and Technology (SKCET)', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri krishna college of technology') || lower.includes('sri krishna college of  technology') || lower.includes('skct')) {
    return { college: 'Sri Krishna College of Technology (SKCT)', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('kalaignar') || lower.includes('kalaingarkarunanidhi') || lower.includes('kalaignarkarunanithi') || lower.includes('kit-kalaignar') || lower.includes('kit - kalaignar') || lower.includes('kit–kalaignar') || lower.includes('kit _ kalaignar') || lower.includes('kit kalaignar')) {
    return { college: 'KIT - Kalaignarkarunanidhi Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sns college of technology') || lower.includes('snsct')) {
    return { college: 'SNS College of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sns college of engineering') || lower.includes('snsce')) {
    return { college: 'SNS College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('n.g.p') || lower.includes('ngp') || lower.includes('n. g. p.')) {
    return { college: 'Dr. N.G.P. Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('kpr institute') || lower.includes('kpriet')) {
    return { college: 'KPR Institute of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('kumaraguru') || lower.includes('kct')) {
    return { college: 'Kumaraguru College of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri ramakrishna engineering college') || lower.includes('srec')) {
    return { college: 'Sri Ramakrishna Engineering College', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri ramakrishna institute of technology') || lower.includes('srit')) {
    return { college: 'Sri Ramakrishna Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri ramakrishna college of arts and science')) {
    return { college: 'Sri Ramakrishna College of Arts and Science', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri eshwar') || lower.includes('sece')) {
    return { college: 'Sri Eshwar College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri shakthi')) {
    return { college: 'Sri Shakthi Institute of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('hindustan institute of technology and science') || lower.includes('hits')) {
    return { college: 'Hindustan Institute of Technology and Science (HITS)', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('hindusthan') || lower.includes('hindustan college')) {
    return { college: 'Hindusthan College of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('karpagam college of engineering')) {
    return { college: 'Karpagam College of Engineering', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('karpagam institute of technology')) {
    return { college: 'Karpagam Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('karpagam academy') || lower.includes('karpagam')) {
    return { college: 'Karpagam Institutions', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('karunya')) {
    return { college: 'Karunya Institute of Technology and Sciences', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('kgisl')) {
    return { college: 'KGISL Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('kg college of arts and science')) {
    return { college: 'KG College of Arts and Science', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('mahalingam') || lower.includes('mcet')) {
    return { college: 'Dr. Mahalingam College of Engineering and Technology', state: 'Tamil Nadu', city: 'Pollachi/Coimbatore' };
  }
  if (lower.includes('bannari amman')) {
    return { college: 'Bannari Amman Institute of Technology', state: 'Tamil Nadu', city: 'Sathyamangalam/Erode' };
  }
  if (lower.includes('adithya institute')) {
    return { college: 'Adithya Institute of Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('akshaya college')) {
    return { college: 'Akshaya College of Engineering and Technology', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('govt. college of technology') || lower.includes('government college of technology') || lower.includes('gct')) {
    return { college: 'Government College of Technology (GCT)', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('sri sai ranganthan') || lower.includes('sri sai ranganathan')) {
    return { college: 'Sri Sai Ranganathan Engineering College', state: 'Tamil Nadu', city: 'Coimbatore' };
  }
  if (lower.includes('csi college of engineering')) {
    return { college: 'CSI College of Engineering', state: 'Tamil Nadu', city: 'Ketti/Nilgiris' };
  }
  if (lower.includes('nandha')) {
    return { college: 'Nandha College of Technology / Engineering', state: 'Tamil Nadu', city: 'Erode' };
  }
  if (lower.includes('erode sengunthar')) {
    return { college: 'Erode Sengunthar Engineering College', state: 'Tamil Nadu', city: 'Erode' };
  }
  if (lower.includes('k.s. rangasamy') || lower.includes('ksr')) {
    return { college: 'K.S. Rangasamy College of Technology', state: 'Tamil Nadu', city: 'Tiruchengode/Namakkal' };
  }
  if (lower.includes('mahendra')) {
    return { college: 'Mahendra Institute of Technology / Engineering', state: 'Tamil Nadu', city: 'Namakkal/Salem' };
  }
  if (lower.includes('m kumarasamy') || lower.includes('kumarasamy')) {
    return { college: 'M. Kumarasamy College of Engineering', state: 'Tamil Nadu', city: 'Karur' };
  }
  if (lower.includes('sona college')) {
    return { college: 'Sona College of Technology', state: 'Tamil Nadu', city: 'Salem' };
  }
  if (lower.includes('chennai institute of technology') || lower.includes('chennai insitute')) {
    return { college: 'Chennai Institute of Technology', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes("st. joseph's college of engineering") || lower.includes("st joseph's college of engineering") || lower.includes("st.joseph's college of engineering")) {
    return { college: "St. Joseph's College of Engineering", state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes("st. joseph's institute of technology") || lower.includes("st joseph's institute of technology") || lower.includes("st joseph's institute of technology")) {
    return { college: "St. Joseph's Institute of Technology", state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('saveetha')) {
    return { college: 'Saveetha Engineering College / SIMATS', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('rajalakshmi')) {
    return { college: 'Rajalakshmi Engineering College', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('sathyabama')) {
    return { college: 'Sathyabama Institute of Science and Technology', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('vel tech') || lower.includes('veltech')) {
    return { college: 'Vel Tech Rangarajan Dr. Sagunthala R&D Institute', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('panimalar')) {
    return { college: 'Panimalar Engineering College', state: 'Tamil Nadu', city: 'Chennai' };
  }
  if (lower.includes('prathyusha')) {
    return { college: 'Prathyusha Engineering College', state: 'Tamil Nadu', city: 'Tiruvallur/Chennai' };
  }
  if (lower.includes('r.m.d') || lower.includes('rmd')) {
    return { college: 'R.M.D Engineering College', state: 'Tamil Nadu', city: 'Kavaraipettai/Chennai' };
  }
  if (lower.includes('karpaga vinayaga')) {
    return { college: 'Karpaga Vinayaga College of Engineering and Technology', state: 'Tamil Nadu', city: 'Chengalpattu' };
  }
  if (lower.includes('srm institute') || lower.includes('srm university') || lower.includes('srmist')) {
    return { college: 'SRM Institute of Science and Technology (SRMIST)', state: 'Tamil Nadu', city: 'Kattankulathur/Trichy' };
  }
  if (lower.includes('takshashila')) {
    return { college: 'Takshashila University', state: 'Tamil Nadu', city: 'Tindivanam/Villupuram' };
  }
  if (lower.includes('thiagarajar')) {
    return { college: 'Thiagarajar College of Engineering / Arts', state: 'Tamil Nadu', city: 'Madurai' };
  }
  if (lower.includes('velammal')) {
    return { college: 'Velammal College of Engineering and Technology', state: 'Tamil Nadu', city: 'Madurai/Chennai' };
  }
  if (lower.includes('mepco')) {
    return { college: 'Mepco Schlenk Engineering College', state: 'Tamil Nadu', city: 'Sivakasi' };
  }
  if (lower.includes('p.s.r') || lower.includes('psr')) {
    return { college: 'P.S.R. Engineering College', state: 'Tamil Nadu', city: 'Sivakasi' };
  }
  if (lower.includes('skp engineering') || lower.includes('skp  engineering')) {
    return { college: 'SKP Engineering College', state: 'Tamil Nadu', city: 'Tiruvannamalai' };
  }
  if (lower.includes('mailam')) {
    return { college: 'Mailam Engineering College', state: 'Tamil Nadu', city: 'Villupuram' };
  }
  if (lower.includes('l.r.g') || lower.includes('lrg')) {
    return { college: 'L.R.G. Government Arts College for Women', state: 'Tamil Nadu', city: 'Tirupur' };
  }
  if (lower.includes('vinayaka mission')) {
    return { college: 'Vinayaka Missions Research Foundation', state: 'Tamil Nadu', city: 'Salem/Chennai' };
  }

  // 3. Maharashtra
  if (lower.includes('vishwakarma') || lower.includes('vit pune') || (lower.includes('vit') && lower.includes('pune'))) {
    return { college: 'Vishwakarma Institute of Technology (VIT Pune)', state: 'Maharashtra', city: 'Pune' };
  }
  if (lower.includes('sanjivani')) {
    return { college: 'Sanjivani College of Engineering', state: 'Maharashtra', city: 'Kopargaon' };
  }

  // 4. Karnataka
  if (lower.includes('presidency university')) {
    return { college: 'Presidency University', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('dayananda sagar')) {
    return { college: 'Dayananda Sagar University', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('visvesvaraya') || lower.includes('sir mvit')) {
    return { college: 'Sir M. Visvesvaraya Institute of Technology', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('bms institute') || lower.includes('bmsit')) {
    return { college: 'BMS Institute of Technology and Management', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('b.m.s.college of engineering') || lower.includes('bmsce')) {
    return { college: 'B.M.S. College of Engineering', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('new horizon')) {
    return { college: 'New Horizon College of Engineering', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('cmr university')) {
    return { college: 'CMR University', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('welingkar')) {
    return { college: 'Prin. L.N. Welingkar Institute (WeSchool)', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('kristu jayanti')) {
    return { college: 'Kristu Jayanti College', state: 'Karnataka', city: 'Bengaluru' };
  }
  if (lower.includes('sahyadri')) {
    return { college: 'Sahyadri College of Engineering & Management', state: 'Karnataka', city: 'Mangaluru' };
  }

  // 5. Telangana & Andhra Pradesh
  if (lower.includes('b v raju') || lower.includes('bvrit')) {
    return { college: 'B V Raju Institute of Technology (BVRIT)', state: 'Telangana', city: 'Narsapur/Hyderabad' };
  }
  if (lower.includes('kakinada') || lower.includes('jntuk')) {
    return { college: 'University College of Engineering Kakinada, JNTUK', state: 'Andhra Pradesh', city: 'Kakinada' };
  }
  if (lower.includes('vignan')) {
    return { college: "Vignan's Foundation for Science, Technology & Research", state: 'Andhra Pradesh', city: 'Guntur' };
  }
  if (lower.includes('madanapalle') || lower.includes('mits')) {
    return { college: 'Madanapalle Institute of Technology & Science', state: 'Andhra Pradesh', city: 'Madanapalle' };
  }
  if (lower.includes('velagapudi') || lower.includes('vrsec')) {
    return { college: 'Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)', state: 'Andhra Pradesh', city: 'Vijayawada' };
  }
  if (lower.includes('rajiv gandhi university of knowledge technologies') || lower.includes('rk valley') || lower.includes('rgukt')) {
    return { college: 'Rajiv Gandhi University of Knowledge Technologies (RGUKT IIIT RK Valley)', state: 'Andhra Pradesh', city: 'Kadapa' };
  }

  // 6. Kerala
  if (lower.includes('nehru college of engineering and research centre')) {
    return { college: 'Nehru College of Engineering and Research Centre', state: 'Kerala', city: 'Thrissur/Palakkad' };
  }
  if (lower.includes('jyothi engineering')) {
    return { college: 'Jyothi Engineering College', state: 'Kerala', city: 'Cheruthuruthy/Thrissur' };
  }
  if (lower.includes('marian engineering')) {
    return { college: 'Marian Engineering College', state: 'Kerala', city: 'Trivandrum' };
  }

  // 7. Uttar Pradesh
  if (lower.includes('vivekananda college of technology and management') || lower.includes('aligarh')) {
    return { college: 'Vivekananda College of Technology and Management', state: 'Uttar Pradesh', city: 'Aligarh' };
  }
  if (lower.includes('jamia hamdard')) {
    return { college: 'Jamia Hamdard', state: 'Delhi', city: 'New Delhi' };
  }

  // 8. Gujarat
  if (lower.includes('karnavati university') || lower.includes('uslm')) {
    return { college: 'Karnavati University (USLM)', state: 'Gujarat', city: 'Gandhinagar' };
  }

  return { college: s, state: 'UNMAPPED', city: 'Unknown' };
}

let unmappedCount = 0;
const unmappedList = [];

distinct.forEach(c => {
  const res = resolveCollegeAndState(c.rawName);
  if (res.state === 'UNMAPPED') {
    unmappedCount++;
    unmappedList.push(c);
  }
});

console.log(`Unmapped distinct raw colleges: ${unmappedCount} out of ${distinct.length}`);
if (unmappedList.length > 0) {
  console.log('Unmapped colleges:');
  unmappedList.forEach(u => console.log(`  [${u.submissionsCount} subs, ${u.paidCount} paid] "${u.rawName}"`));
}

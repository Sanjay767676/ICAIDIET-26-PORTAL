// The eight conference tracks. Single source of truth for the submission
// wizard and the Phase 2 (camera-ready) form, so the two dropdowns can never
// drift apart. Keys must match PHASE2_TRACKS in backend/src/index.ts.
export const CONFERENCE_TRACKS = [
  { value: 'ai-intelligent-systems', label: 'Artificial Intelligence & Intelligent Systems' },
  { value: 'ml-advanced-analytics', label: 'Machine Learning & Advanced Analytics' },
  { value: 'data-science-decision-intelligence', label: 'Data Science & Decision Intelligence' },
  { value: 'iot-edge-embedded', label: 'IoT, Edge Computing & Embedded Systems' },
  { value: 'communication-network', label: 'Communication Systems & Network Technologies' },
  { value: 'cybersecurity', label: 'Cybersecurity & Secure Computing' },
  { value: 'robotics-automation', label: 'Robotics, Automation & Smart Industry' },
  {
    value: 'emerging-tech-sustainability',
    label: 'Emerging Technologies, Sustainability & AI Management',
  },
] as const;

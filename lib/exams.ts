import { findSubject } from '@/lib/curriculum'
import type { ExamKind, Year } from '@/lib/exam-dates'

/**
 * Exam timetables, typed in from the Controller of Examinations' notices (no images are stored).
 * Branch keys are the site's branch ids. A day with no paper for a branch is an empty list; a day
 * can hold several papers (electives). Check the official notice for last-minute changes.
 */
export { KIND_LABEL, YEAR_LABEL, dayParts, daysUntil } from '@/lib/exam-dates'
export type { ExamKind, Year } from '@/lib/exam-dates'

export interface Paper {
  code: string
  name: string
}
export interface ExamDay {
  /** ISO date, e.g. 2026-12-07 */
  date: string
  time: string
}
export interface Exam {
  year: Year
  kind: ExamKind
  title: string
  regulation: string
  days: ExamDay[]
  /** Branch id → one list of papers per day. */
  rows: Record<string, string[][]>
  notes?: string[]
  /** Open-elective papers that sit under a day's "Open Elective" entry. */
  openElectives?: { label: string; papers: string[] }
}

/** Fallback names (the site's own subject names are used when a code is on VJNOTES). */
const N: Record<string, string> = {
  // 1st year (R25)
  '25PC1CE101': 'Engineering Geology and Building Materials',
  '25BS1PH101': 'Applied Physics',
  '25BS1PH102': 'Advanced Engineering Physics',
  '25BS1PH103': 'Physics for Computing Science',
  '25BS1MT101': 'Matrices and Calculus',
  '25BS1MT102': 'Discrete Mathematics',
  '25BS1MT103': 'Introductory Topics in Statistics, Probability and Calculus',
  '25BS1CH101': 'Chemistry for Engineers',
  '25ES1EE104': 'Elements of Electrical and Electronics Engineering',
  '25ES1EE101': 'Basic Electrical Engineering',
  '25ES1EE102': 'Basic Electrical and Electronics Engineering',
  '25ES1EE105': 'Network Analysis',
  '25ES1EE106': 'Principles of Electrical Engineering',
  '25ES1CS101': 'Programming for Problem Solving',
  '25ES1DS101': 'Problem Solving Through C',
  '25ES1CB101': 'Fundamentals of Computer Science',
  '25ES1CY101': 'Introduction to Cyber Security',
  '25ES1AD101': 'Introduction to AI and Data Science',
  '25ES1EI101': 'Introduction to IoT and Applications',
  '25ES1IN101': 'Introduction to Internet of Things',
  '25ES1ME101': 'Engineering Mechanics',
  '25HS1EN101': 'English for Skill Enhancement',
  '25PC1EE101': 'Electrical Circuits-I',
  '25PC1ME101': 'Manufacturing Processes',
  '25PC1AE101': 'Manufacturing Technology',
  '25PC1AM101': 'Mathematical Foundations of Computer Science',
  // 2nd year (R25)
  '25BS1MT201': 'Probability and Statistics',
  '25BS1MT202': 'Numerical Methods and Complex Variables',
  '25BS1MT203': 'Probability, Statistics and Partial Differential Equations',
  '25BS1MT204': 'Probability and Statistical Analysis',
  '25PC1CE201': 'Strength of Materials',
  '25PC1CE202': 'Concrete Technology',
  '25PC1CE203': 'Fluid Mechanics',
  '25ES1AM101': 'C Programming and Data Structures',
  '25PC1EE201': 'Electromagnetic Fields',
  '25PC1EE202': 'Electrical Machines-I',
  '25PC1EC231': 'Analog Electronics',
  '25PC1EC232': 'Digital Electronics',
  '25HS1MG201': 'Innovation and Entrepreneurship',
  '25HS1MG203': 'Marketing Research and Marketing Management',
  '25PC1ME201': 'Mechanics of Solids',
  '25PC1ME202': 'Machine Tools and Metrology',
  '25PC1ME203': 'Fluid Mechanics and Hydraulic Machines',
  '25PC1ME204': 'Kinematics of Machinery',
  '25PC1ME205': 'Metallurgy and Materials Science',
  '25PC1EC201': 'Probability Theory and Stochastic Processes',
  '25PC1EC202': 'Signals and Systems',
  '25PC1EC203': 'Electronic Circuit Analysis',
  '25PC1EC204': 'Digital Logic Design',
  '25PC1CS201': 'Object Oriented Programming Through JAVA',
  '25PC1CS202': 'Unified Software Engineering',
  '25PC1CS204': 'Discrete Structures and Graph Theory',
  '25PC1IT201': 'Database Management Systems',
  '25PC1IT202': 'Internet of Things',
  '25PC1IT204': 'Operating Systems',
  '25PC1IT205': 'Computer Organization and Microprocessor',
  '25PC1IT208': 'Computer Organization and Architecture',
  '25PC1EI201': 'Electronic Devices and Circuits-I',
  '25PC1EI202': 'Electronic Measurements',
  '25PC1AE201': 'Engineering Metallurgy and Materials',
  '25PC1AE202': 'Mechanics of Materials',
  '25PC1AE203': 'Fundamentals of Thermodynamics',
  '25PC1AE204': 'Automotive Chassis',
  '25PC1CB201': 'Database Management Systems',
  '25PC1CB202': 'Object Oriented Programming',
  '25PC1CB204': 'Computer Organization and Architecture',
  '25PC1CB205': 'Software Engineering',
  '25PC1CY201': 'Computer Networks',
  '25PC1EV201': 'Analog Circuits',
  '25PC1EV202': 'Signals and Stochastic Processes',
  '25PC1EV203': 'RTL Modeling and Synthesis',
  '25PC1RA201': 'Object Oriented Programming Through C++',
  '25PC1RA202': 'Sensors and Actuators for Robotics',
  '25PC1RA205': 'Fundamentals of Robotics and Artificial Intelligence',
  // 3rd year (R22)
  '22PC1CE301': 'Design of Reinforced Concrete Structures',
  '22PC1CE302': 'Water Resources Engineering',
  '22PC1CE303': 'Estimation and Costing',
  '22PE1CE301': 'Pavement Analysis and Design',
  '22PE1CE304': 'Traffic Engineering',
  '22PC1EE301': 'Power Electronics',
  '22PC1EE302': 'Power Systems – II',
  '22PC1EE205': 'Control Systems',
  '22PC1EE303': 'Sustainable Energy Solutions',
  '22PE1EE301': 'Utilization of Electrical Energy',
  '22PE1EC321': 'Introduction to VLSI Design',
  '22PE1EC320': 'Fundamentals of Signals and Systems',
  '22PC1ME301': 'Thermal Engineering',
  '22PC1ME302': 'Automation and Robotics',
  '22PC1ME303': 'Mechanical Engineering Design',
  '22PE1ME301': 'Non-Conventional Energy Sources',
  '22PE1ME302': 'Industrial Engineering and Management',
  '22PC1EC301': 'Microprocessors and Microcontrollers',
  '22PC1EC302': 'Digital Signal Processing',
  '22PC1EC303': 'Antennas and Wave Propagation',
  '22PE1MT301': 'Essential Mathematics for Machine Learning',
  '22PE1EC301': 'Information Theory and Coding',
  '22PE1EC302': 'Real Time Operating Systems',
  '22PE1EC303': 'HDL Based Design and Verification',
  '22PC1AM203': 'Automata and Compiler Design',
  '22PC1IN202': 'Computer Networks',
  '22PC1AM301': 'Artificial Intelligence',
  '22HS1MG301': 'Principles of Management and Organizational Behavior',
  '22PE1IT302': 'Agile Software Process',
  '22PE1AM305': 'Internet of Things',
  '22PC1IT301': 'Data Mining',
  '22PC1EI301': 'Industrial Process Control Instrumentation',
  '22PC1EI302': 'Essentials of VLSI Design',
  '22PC1EC208': 'Computer Organization and Design',
  '22PE1EI301': 'Fundamentals of Robotics and Automation',
  '22PC1IT202': 'Operating Systems',
  '22PE1EI302': 'Power Plant Instrumentation',
  '22PE1EI303': 'Fiber Optics and Laser Instrumentation',
  '22PE1IT301': 'Scripting Languages',
  '22PE1CS302': 'Image Processing',
  '22PC1AE301': 'Automotive Electrical and Electronics',
  '22PC1AE302': 'Vehicle Dynamics',
  '22PC1AE303': 'Design for Automotive Components',
  '22PE1AE301': 'Vehicle Body Engineering',
  '22PE1AE302': 'Aerodynamics of Road Vehicles',
  '22PE1AE304': 'Motorsport Engineering',
  '22HS1MG302': 'Fundamentals of Economics',
  '22PC1CB302': 'Machine Learning',
  '22PC1CB301': 'Computer Networks',
  '22PE1CB303': 'Data Mining and Analytics',
  '22PE1CB301': 'Conversational Systems',
  '22OE1CB301': 'Introduction to IoT',
  '22PC1CY301': 'Secure Software Engineering',
  '22PC1CY302': 'Malware Analysis',
  '22PC1DS301': 'Models in Data Science',
  '22PE1CY301': 'Information and Network Security',
  '22PC1AM302': 'Machine Learning',
  '22PE1AM301': 'Web Programming',
  '22PE1AM302': 'Explainable AI',
  '22PC1CY201': 'Computer Networks and Ethical Hacking',
  '22PC1DS302': 'Cloud Computing Technologies',
  '22PE1DS301': 'Unsupervised Learning Algorithms',
  '22PC1AM202': 'Data Engineering',
  '22PC1IN301': 'IoT Architecture and Protocols',
  '22PC1AD301': 'Artificial Intelligence Essentials',
  // 4th year (R22)
  '22PC1CE401': 'Foundation Engineering',
  '22PC1CE402': 'Innovation and Entrepreneurship',
  '22PE1CE405': 'Construction Technology and Project Management',
  '22PC1EE401': 'Switchgear and Protection',
  '22PC1EC421': 'Principles of Digital Signal Processing',
  '22PE1EE403': 'Electric Vehicle',
  '22PC1ME401': 'Industry 5.0',
  '22PC1ME402': 'Turbomachinery',
  '22PE1ME401': 'Computational Fluid Dynamics',
  '22PE1ME404': 'Mechanics of Composite Materials',
  '22PE1ME405': 'Modern Machining Processes',
  '22HS1MG201': 'Engineering Economics and Accountancy',
  '22PC1EC401': 'Microwave Engineering',
  '22PE1EC401': 'Cellular and Mobile Communications',
  '22PE1EC403': 'Languages for Embedded Software',
  '22PE1EC404': 'VLSI Scripting Languages',
  '22PE1EC405': 'Organic Electronics',
  '22PC1CS401': 'Big Data Analytics',
  '22PC1AM402': 'DevOps',
  '22PE1CS402': 'Deep Learning',
  '22PC1EI401': 'Architecture and Protocols of Internet of Things',
  '22PC1EI402': 'Analytical Instrumentation',
  '22PE1EI402': 'Instrumentation for Petrochemical Industries',
  '22PE1EC421': 'Wireless Sensor Networks and Protocols',
  '22PC1DS303': 'Big Data Computing Technologies',
  '22PC1DS402': 'Deep Learning Applications',
  '22PE1IN303': 'Adhoc and Sensor Networks',
  '22PE1IT402': 'Software Project Management',
  '22PE1CS401': 'Advanced Databases',
  '22PC1AE401': 'Advanced Driver Assistance Systems',
  '22PC1AE402': 'Automotive Embedded Systems',
  '22PE1AE401': 'AI for Autonomous and Connected Vehicles',
  '22PE1AE402': 'Two and Three-Wheeler Technology',
  '22PE1AE403': 'Advanced Manufacturing Technologies',
  '22PC1CB401': 'Usability Design of Software Applications',
  '22HS1MG401': 'Financial Management',
  '22PE1CB401': 'Cognitive Science and Analytics',
  '22PE1CB406': 'Information Retrieval Systems',
  '22OE1CB401': 'Human Resource Management',
  '22PC1CY401': 'Blockchain Technology',
  '22PC1CY402': 'Security Operations Center',
  '22PE1CY401': 'Cyber Threat Intelligence',
  '22PC1AM401': 'Image Processing and Computer Vision',
  '22PE1AM402': 'Reinforcement Learning',
  '22PE1AM403': 'Information Retrieval Systems',
  '22PC1DS401': 'Data Science for BFSI',
  '22PE1DS401': 'Natural Language Processing and Text Analytics',
  '22PC1IN401': 'Embedded GPU',
  '22PE1IN402': 'IoT for Smart Cities',
}

const OE = 'OE'
/** The marker for an "Open Elective" paper in a day (it opens the elective list). */
export const OPEN_ELECTIVE = OE

/** Looks a code up: the site's own subject (linkable) or the name from the notice. */
export function paperOf(code: string): Paper & { onSite: boolean } {
  if (code === OE) return { code, name: 'Open Elective', onSite: false }
  const found = findSubject(code)
  return { code, name: found?.subject.name ?? N[code] ?? code, onSite: Boolean(found) }
}

const NONE: string[] = []

// ---- 1st year (R25): the same papers in Sessional II and the semester exam ----
const MT = '25BS1MT101'
const CS = '25ES1CS101'
const EN = '25HS1EN101'
const CH = '25BS1CH101'
const PH1 = '25BS1PH101'
const PH2 = '25BS1PH102'
const E101 = '25ES1EE101'
const E102 = '25ES1EE102'
const Y1: Record<string, string[][]> = {
  ce: [['25PC1CE101'], [PH1], [MT], ['25ES1EE104'], [EN]],
  eee: [['25PC1EE101'], [PH2], [MT], [CS], [EN]],
  me: [['25PC1ME101'], [PH1], [MT], ['25ES1ME101'], [EN]],
  ece: [['25ES1EE105'], [PH2], [MT], [CS], [EN]],
  cse: [[E101], [CH], [MT], [CS], NONE],
  eie: [['25ES1EI101'], [CH], [MT], [CS], [EN]],
  it: [[E101], [CH], [MT], [CS], NONE],
  ae: [['25PC1AE101'], [PH1], [MT], ['25ES1DS101'], [EN]],
  csbs: [['25ES1EE106'], ['25BS1PH103'], ['25BS1MT102'], ['25ES1CB101'], ['25BS1MT103']],
  rai: [[E102], [CH], [MT], [CS], NONE],
  'cse-cys': [[E102], [CH], [MT], [CS], ['25ES1CY101']],
  'cse-aiml': [['25PC1AM101'], [PH2], [MT], [CS], NONE],
  'cse-ds': [[E102], [CH], [MT], [CS], NONE],
  'cse-iot': [['25ES1IN101'], [PH2], [MT], [CS], [EN]],
  aids: [[E102], [CH], [MT], [CS], ['25ES1AD101']],
  evl: [['25ES1EE105'], [PH2], [MT], [CS], [EN]],
}

// ---- 2nd year (R25) ----
const MG = '25HS1MG201'
const J = '25PC1CS201'
const DBMS = '25PC1IT201'
const M204 = '25BS1MT204'
const COA = '25PC1IT208'
const DSG = '25PC1CS204'
const Y2: Record<string, string[][]> = {
  ce: [['25BS1MT201'], ['25PC1CE201'], ['25PC1CE202'], ['25PC1CE203'], ['25ES1AM101', '25PC1CE101'], NONE],
  eee: [['25PC1EE201'], ['25PC1EE202'], ['25PC1EC231'], ['25PC1EC232'], [MG], NONE],
  me: [['25PC1ME201'], ['25PC1ME202'], ['25PC1ME203'], ['25PC1ME204'], ['25PC1ME205', '25ES1EE104'], NONE],
  ece: [['25PC1EC201'], ['25PC1EC202'], ['25PC1EC203'], ['25PC1EC204'], [MG], NONE],
  cse: [['25PC1CS202'], [DBMS], [J], [COA], [MG], [DSG]],
  eie: [['25BS1MT202'], ['25PC1EC202'], ['25PC1EI201'], ['25PC1EI202'], [MG], NONE],
  it: [['25PC1IT202'], [DBMS], [J], ['25PC1IT205'], [MG], [DSG]],
  ae: [['25BS1MT203'], ['25PC1AE201'], ['25PC1AE202'], ['25PC1AE203'], ['25PC1AE204'], NONE],
  csbs: [['25PC1CB201'], ['25PC1CB202'], ['25PC1CB204'], ['25PC1CB205'], ['25HS1MG203'], NONE],
  'cse-cys': [[M204], NONE, [J], ['25PC1CY201'], ['25PC1IT204'], NONE],
  'cse-aiml': [[M204], [DBMS], [J], NONE, ['25PC1IT204'], NONE],
  'cse-ds': [[M204], [DBMS], [J], [COA], NONE, [DSG]],
  'cse-iot': [[M204], [DBMS], [J], ['25PC1CY201'], [MG], NONE],
  aids: [[M204], [DBMS], [J], [COA], NONE, [DSG]],
  evl: [['25PC1EV201'], ['25PC1EV202'], ['25PC1EV203'], ['25PC1EC204'], [MG], NONE],
  rai: [[M204], ['25PC1RA201'], ['25PC1RA202'], ['25PC1RA205'], [MG], NONE],
}

// ---- 3rd year (R22) ----
const Y3: Record<string, string[][]> = {
  ce: [['22PC1CE301'], ['22PC1CE302'], ['22PC1CE303'], ['22PE1CE301', '22PE1CE304'], [OE], NONE, NONE],
  eee: [['22PC1EE301'], ['22PC1EE302'], ['22PC1EE205'], ['22PC1EE303'], [OE], ['22PE1EE301', '22PE1EC321', '22PE1EC320'], NONE],
  me: [['22PC1ME301'], ['22PC1ME302'], ['22PC1ME303'], ['22PE1ME301', '22PE1ME302'], [OE], NONE, NONE],
  ece: [['22PC1EC301'], ['22PC1EC302'], ['22PC1EC303'], ['22PE1MT301', '22PE1EC301', '22PE1EC302', '22PE1EC303'], [OE], NONE, NONE],
  cse: [['22PC1AM203'], ['22PC1IN202'], ['22PC1AM301'], ['22HS1MG301'], [OE], ['22PE1IT302', '22PE1AM305'], ['22PC1IT301']],
  eie: [['22PC1EI301'], ['22PC1EC302'], ['22PC1EI302'], ['22PC1EC208'], [OE], ['22PE1EI301', '22PC1IT202', '22PE1EI302', '22PE1EI303'], NONE],
  it: [['22PC1AM203'], ['22PC1IN202'], NONE, ['22HS1MG301'], [OE], ['22PE1IT301', '22PE1IT302', '22PE1AM305', '22PE1CS302'], ['22PC1IT301']],
  ae: [['22PC1AE301'], ['22PC1AE302'], ['22PC1AE303'], ['22PE1AE301', '22PE1AE302', '22PE1AE304'], [OE], NONE, NONE],
  csbs: [['22HS1MG302'], ['22PC1CB302'], ['22PC1CB301'], ['22PE1CB303', '22PE1CB301'], ['22OE1CB301'], NONE, NONE],
  'cse-cys': [['22PC1CY301'], ['22PC1CY302'], ['22PC1DS301'], ['22PE1CY301'], [OE], ['22PC1IT202'], NONE],
  'cse-aiml': [['22PC1AM302'], ['22PC1IN202'], ['22PC1AM301'], ['22PE1AM301', '22PE1AM302'], [OE], ['22PC1IT202'], NONE],
  'cse-ds': [['22PC1AM203'], ['22PC1CY201'], ['22PC1DS301'], ['22PC1DS302'], [OE], ['22PE1DS301'], NONE],
  'cse-iot': [['22PC1AM203'], ['22PC1AM202'], ['22PC1IN301'], ['22PE1AM301'], [OE], ['22PC1IT202'], NONE],
  aids: [['22PC1AM203'], ['22PC1CY201'], ['22PC1AD301'], ['22PC1DS302'], [OE], ['22PE1DS301'], NONE],
}

// ---- 4th year (R22) ----
const DEVOPS = '22PC1AM402'
const DLA = '22PC1DS402'
const Y4: Record<string, string[][]> = {
  ce: [['22PC1CE401'], ['22PC1CE402'], ['22PE1CE405'], [OE], NONE],
  eee: [['22PC1EE401'], ['22PC1EC421'], ['22PE1EE403'], [OE], NONE],
  me: [['22PC1ME401'], ['22PC1ME402'], ['22PE1ME401', '22PE1ME404', '22PE1ME405'], [OE], NONE],
  ece: [['22HS1MG201'], ['22PC1EC401'], ['22PE1EC401', '22PE1EC403', '22PE1EC404', '22PE1EC405'], [OE], NONE],
  cse: [['22PC1CS401'], [DEVOPS], ['22PE1CY301', '22PE1CS402'], [OE], NONE],
  eie: [['22PC1EI401'], ['22PC1EI402'], ['22PE1EI402', '22PE1EC421'], [OE], NONE],
  it: [['22PC1DS303'], [DLA], ['22PE1IN303', '22PE1IT402', '22PE1CS401'], [OE], NONE],
  ae: [['22PC1AE401'], ['22PC1AE402'], ['22PE1AE401', '22PE1AE402', '22PE1AE403'], [OE], NONE],
  csbs: [['22PC1CB401'], ['22HS1MG401'], ['22PE1CB401'], ['22PE1CB406'], ['22OE1CB401']],
  'cse-cys': [['22PC1CY401'], ['22PC1CY402'], ['22PE1CY401'], [OE], NONE],
  'cse-aiml': [['22PC1AM401'], [DEVOPS], ['22PE1AM402', '22PE1AM403'], [OE], NONE],
  'cse-ds': [['22PC1DS401'], [DLA], ['22PE1DS401'], [OE], NONE],
  'cse-iot': [['22PC1IN401'], [DEVOPS], ['22PE1IN402'], [OE], NONE],
  aids: [['22PC1DS401'], [DLA], ['22PE1DS401'], [OE], NONE],
}

const d = (date: string, time: string): ExamDay => ({ date, time })
const MORNING = '10:00 AM – 12:00 Noon'
const FORENOON = '10:00 AM – 1:00 PM'
const AFTERNOON = '2:00 PM – 5:00 PM'

export const EXAMS: Exam[] = [
  {
    year: 1,
    kind: 'sess2',
    title: 'I B.Tech I Semester · Sessional Examination-II',
    regulation: 'R25',
    days: ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'].map((x) => d(x, MORNING)),
    rows: Y1,
  },
  {
    year: 1,
    kind: 'sem',
    title: 'I B.Tech I Semester · Regular & Supplementary Examination',
    regulation: 'R25',
    days: ['2026-12-21', '2026-12-23', '2026-12-28', '2026-12-30', '2027-01-02'].map((x) => d(x, FORENOON)),
    rows: Y1,
  },
  {
    year: 2,
    kind: 'sem',
    title: 'II B.Tech I Semester · Regular Examination',
    regulation: 'R25',
    days: ['2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27', '2026-12-01', '2026-12-03'].map((x) => d(x, FORENOON)),
    rows: Y2,
    notes: [
      'On 1 December, CE also has Engineering Geology and Building Materials and ME also has Elements of Electrical and Electronics Engineering (listed on the extra page of the notice).',
    ],
  },
  {
    year: 3,
    kind: 'sem',
    title: 'III B.Tech I Semester · Regular & Supplementary Examination',
    regulation: 'R22',
    days: ['2026-11-19', '2026-11-21', '2026-11-24', '2026-11-26', '2026-11-30', '2026-12-02', '2026-12-04'].map((x) => d(x, AFTERNOON)),
    rows: Y3,
    openElectives: {
      label: 'Open Elective-I (30 Nov, 2:00 – 5:00 PM)',
      papers: [
        '22OE1CE301 · Smart Cities Planning and Development',
        '22OE1CE303 · Solid Waste Management',
        '22OE1EE301 · Renewable Energy Sources',
        '22OE1ME301 · Elements of CAD',
        '22OE1EC301 · Sensors, Transducers and Actuators',
        '22OE1EC309 · Fundamentals of Microelectronics',
        '22OE1EC307 · 5G/6G Technologies',
        '22OE1MT301 · Applied Mathematics in Artificial Intelligence',
        '22OE1MT302 · Mathematical Foundations for Artificial Intelligence',
        '22OE1EI301 · Fundamentals of Robotics',
        '22OE1CS301 · Fundamentals of Computer Networks',
        '22OE1CS302 · Relational Data Base Management Systems',
        '22OE1CS304 · AI for Beginners',
        '22OE1AE301 · Principles of Automobile Engineering',
        '22OE1MT303 · Statistical Methods for Data Science',
        '22OE1HS301 · Professional Ethics and Human Values',
        '22OE1CE305 · Smart Cities',
        '22OE1EE303 · Trends in Energy Sources for Sustainable Development',
        '22OE1ME303 · 3D Printing and Design',
        '22OE1EI303 · Fundamentals of Robotics and Drones',
        '22OE1AE403 · Green Hydrogen',
        '22OE1CS310 · Introduction to Application Development with C#',
        '22OE1MT304 · Numerical Methods and Linear Programming',
        '22OE1CH301 · Introduction to Climate Change',
        '22OE1EN301 · Storytelling for Effective Communication',
        '22OE1EN303 · Creative Writing',
        '22OE1MG305 · Human Resource Management',
        '22OE1EN302 · Film Analysis and Critical Appreciation',
        '22OE1MG302 · Personal Finance and Tax Planning',
        '22OE1MG301 · Fundamentals of Management',
      ],
    },
  },
  {
    year: 4,
    kind: 'sem',
    title: 'IV B.Tech I Semester · Regular & Supplementary Examination',
    regulation: 'R22',
    days: ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23', '2026-11-25'].map((x) => d(x, AFTERNOON)),
    rows: Y4,
    notes: ['NPTEL course papers (supplementary) are on 25 November, 2:00 – 5:00 PM. Ask your department for the paper list.'],
    openElectives: {
      label: 'Open Elective-III (23 Nov, 2:00 – 5:00 PM)',
      papers: [
        '22OE1CE401 · Smart Materials and Structures',
        '22OE1CE403 · Waste to Energy',
        '22OE1EE401 · Energy Storage Technologies',
        '22OE1ME401 · 3D Printing – Tooling and Systems',
        '22OE1EC401 · Fundamentals of Internet of Things',
        '22OE1EC405 · Fundamentals of Physical Design for VLSI',
        '22OE1CS401 · Machine Learning Techniques',
        '22OE1EI401 · Drive Systems for Robots',
        '22OE1IT401 · Essentials of Cyber Security',
        '22OE1IT403 · Fundamentals of Data Mining',
        '22OE1AE401 · Electric, Hybrid and Fuel Cell Vehicles',
        '22OE1CE305 · Smart Cities',
        '22OE1EE303 · Trends in Energy Sources for Sustainable Development',
        '22OE1ME303 · 3D Printing and Design',
        '22OE1EC307 · 5G/6G Technologies',
        '22OE1CS304 · AI for Beginners',
        '22OE1EI303 · Fundamentals of Robotics and Drones',
        '22OE1AE303 · Introduction to Advanced Vehicle Technologies',
        '22OE1AE403 · Green Hydrogen',
        '22OE1PH302 · Essentials for Quantum Computing',
        '22OE1CH301 · Introduction to Climate Change',
        '22OE1CH302 · Sustainable Chemistry for Engineering',
        '22OE1EN401 · Cross-Cultural Communication Through World Literature',
        '22OE1MG302 · Personal Finance and Tax Planning',
      ],
    },
  },
]

export function examFor(year: Year, kind: ExamKind) {
  return EXAMS.find((e) => e.year === year && e.kind === kind)
}

/** The branches an exam covers, in the order of the site's branch list. */
export function examBranches(exam: Exam) {
  return Object.keys(exam.rows)
}

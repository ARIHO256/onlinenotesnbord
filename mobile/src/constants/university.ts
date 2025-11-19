export const SCHOOLS = [
  'School of Science and Technology',
  'School of Education',
  'School of Business',
  'School of Graduate Studies',
  'School of Social Sciences',
  'School of Health Sciences',
  'School of Theology and Religious Studies',
  'School of Agriculture and Environmental Sciences',
];

export const DEPARTMENTS_BY_SCHOOL: Record<string, string[]> = {
  'School of Science and Technology': [
    'Computer Science',
    'Information Technology',
    'Mathematics',
    'Physics',
    'Biology',
    'Chemistry',
  ],
  'School of Education': [
    'Curriculum and Teaching',
    'Educational Administration',
    'Psychology and Counselling',
    'Library and Information Science',
  ],
  'School of Business': [
    'Accounting and Finance',
    'Management',
    'Human Resource Management',
    'Marketing',
    'Procurement and Logistics',
  ],
  'School of Graduate Studies': [
    'Graduate Business',
    'Graduate Education',
    'Graduate Public Health',
    'Graduate Theology',
  ],
  'School of Social Sciences': [
    'Development Studies',
    'Governance and International Relations',
    'Sociology and Social Work',
    'Communication and Journalism',
  ],
  'School of Health Sciences': [
    'Nursing',
    'Public Health',
    'Medical Laboratory Sciences',
    'Pharmacy',
  ],
  'School of Theology and Religious Studies': [
    'Pastoral Theology',
    'Religious Studies',
    'Chaplaincy and Counselling',
  ],
  'School of Agriculture and Environmental Sciences': [
    'Agriculture',
    'Environmental Science',
    'Food Science and Technology',
  ],
};

export const COURSES_BY_DEPARTMENT: Record<string, string[]> = {
  'Computer Science': [
    'BSc Computer Science',
    'Diploma in Computer Science',
    'MSc Computer Science',
  ],
  'Information Technology': [
    'BSc Information Technology',
    'Diploma in Information Technology',
    'MSc Information Systems',
  ],
  'Mathematics': [
    'BSc Mathematics',
    'BSc Statistics',
    'MSc Applied Mathematics',
  ],
  'Physics': [
    'BSc Physics',
    'BSc Physics and Education',
  ],
  'Biology': [
    'BSc Biology',
    'BSc Biotechnology',
  ],
  'Chemistry': [
    'BSc Chemistry',
    'BSc Industrial Chemistry',
  ],
  'Curriculum and Teaching': [
    'Bachelor of Arts with Education',
    'Bachelor of Science with Education',
    'Master of Education in Curriculum and Instruction',
  ],
  'Educational Administration': [
    'Bachelor of Educational Management',
    'Master of Education in Educational Management',
  ],
  'Psychology and Counselling': [
    'Bachelor of Counselling Psychology',
    'Master of Science in Counselling Psychology',
  ],
  'Library and Information Science': [
    'Bachelor of Library and Information Science',
    'Diploma in Library and Information Science',
  ],
  'Accounting and Finance': [
    'Bachelor of Business Administration (Accounting)',
    'Bachelor of Commerce (Finance)',
    'MBA (Accounting and Finance)',
  ],
  'Management': [
    'Bachelor of Business Administration (Management)',
    'Bachelor of Business Administration (Entrepreneurship)',
    'MBA (Management)',
  ],
  'Human Resource Management': [
    'Bachelor of Human Resource Management',
    'MBA (Human Resource Management)',
  ],
  'Marketing': [
    'Bachelor of Marketing',
    'MBA (Marketing)',
  ],
  'Procurement and Logistics': [
    'Bachelor of Procurement and Logistics Management',
    'Diploma in Procurement and Logistics Management',
  ],
  'Graduate Business': [
    'MBA',
    'MSc Supply Chain Management',
  ],
  'Graduate Education': [
    'Master of Education in Educational Management',
    'Master of Education in Curriculum and Instruction',
  ],
  'Graduate Public Health': [
    'Master of Public Health',
  ],
  'Graduate Theology': [
    'Master of Theology',
  ],
  'Development Studies': [
    'Bachelor of Development Studies',
    'Master of Development Studies',
  ],
  'Governance and International Relations': [
    'Bachelor of Governance and International Relations',
    'Master of Governance and International Relations',
  ],
  'Sociology and Social Work': [
    'Bachelor of Social Work and Social Administration',
    'Bachelor of Sociology',
  ],
  'Communication and Journalism': [
    'Bachelor of Mass Communication',
    'Bachelor of Journalism and Communication',
  ],
  'Nursing': [
    'Bachelor of Nursing Science',
    'Diploma in Nursing',
  ],
  'Public Health': [
    'Bachelor of Public Health',
    'Diploma in Public Health',
  ],
  'Medical Laboratory Sciences': [
    'Bachelor of Medical Laboratory Science',
  ],
  'Pharmacy': [
    'Bachelor of Pharmacy',
  ],
  'Pastoral Theology': [
    'Bachelor of Theology',
    'Diploma in Theology',
  ],
  'Religious Studies': [
    'Bachelor of Arts in Religion',
  ],
  'Chaplaincy and Counselling': [
    'Bachelor of Chaplaincy',
  ],
  'Agriculture': [
    'Bachelor of Agriculture',
    'Diploma in Agriculture',
  ],
  'Environmental Science': [
    'Bachelor of Environmental Science',
    'Master of Environmental Management',
  ],
  'Food Science and Technology': [
    'Bachelor of Food Science and Technology',
  ],
};

const startYear = 2010;
const endYear = 2026;
export const ACADEMIC_YEARS = Array.from({ length: endYear - startYear }, (_, idx) => {
  const first = startYear + idx;
  const second = first + 1;
  return `${first}-${second}`;
});

// Cross-cutting official departments that send notices to all students
export const CROSS_CUTTING_OFFICIAL_DEPARTMENTS = [
  'Registrar',
  'Vice Chancellor',
  'Business Office',
  'Head of Security',
  'Chaplain',
];

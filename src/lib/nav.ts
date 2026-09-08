export type NavLink = {
  href: string;
  label: string;
};

export type NavGroup = {
  heading: string;
  items: NavLink[];
};

export const serviceGroups: NavGroup[] = [
  {
    heading: "School administration",
    items: [
      { href: "/services/school-management", label: "School Management" },
      { href: "/services/infrastructure", label: "Infrastructure" },
      { href: "/services/admissions", label: "Admissions" },
      { href: "/services/examinations", label: "Examinations" },
      { href: "/services/timetable", label: "Timetable" },
    ],
  },
  {
    heading: "Student life",
    items: [
      { href: "/services/sports", label: "Sports" },
      { href: "/services/seminars", label: "Seminars" },
      { href: "/services/student-visits", label: "Student Visits" },
      { href: "/services/cultural-activities", label: "Cultural Activities" },
      { href: "/services/health-safety", label: "Health & Safety" },
    ],
  },
  {
    heading: "Operations & guidance",
    items: [
      { href: "/services/government-schemes", label: "Government Schemes" },
      { href: "/services/marketing", label: "Marketing" },
      { href: "/services/accounting-taxation", label: "Accounting & Taxation" },
      { href: "/services/procurement", label: "Procurement" },
      { href: "/services/career-counselling", label: "Career Counselling" },
    ],
  },
];

export const serviceLinks: NavLink[] = serviceGroups.flatMap(
  (group) => group.items,
);

export const communityLinks: NavLink[] = [
  { href: "/members", label: "Members" },
  { href: "/forum", label: "Forums" },
  { href: "/community", label: "Teacher Social" },
];

export const primaryLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/consult", label: "Consult" },
  { href: "/blog", label: "Blog" },
  { href: "/news", label: "News" },
  { href: "/resources", label: "Resources" },
  { href: "/store", label: "Store" },
  { href: "/events", label: "Events" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export const authLinks: NavLink[] = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

export const footerColumns: NavGroup[] = [
  {
    heading: "About",
    items: [
      { href: "/about", label: "About Us" },
      { href: "/about#mission", label: "Mission & Vision" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    heading: "Community",
    items: [
      { href: "/community", label: "Teacher Social" },
      { href: "/forum", label: "EduVoq Forums" },
      { href: "/members", label: "Community Members" },
      { href: "/blog", label: "Blogs & Articles" },
    ],
  },
  {
    heading: "Learn",
    items: [
      { href: "/consult", label: "Consulting Services" },
      { href: "/resources/learning-material", label: "Learning Material" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
    ],
  },
];

export const CONTACT_EMAIL = "hello@eduvoq.com";

export type NavLink = {
  href: string;
  label: string;
};

export type NavGroup = {
  heading: string;
  items: NavLink[];
};

export type PrimaryNavItem =
  | {
      type: "link";
      href: string;
      label: string;
    }
  | {
      type: "cluster";
      label: string;
      groups: NavGroup[];
      /** Prefix used to mark the trigger active (e.g. /services). */
      activeHref?: string;
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

export const primaryNav: PrimaryNavItem[] = [
  { type: "link", href: "/", label: "Home" },
  { type: "link", href: "/about", label: "About" },
  {
    type: "cluster",
    label: "Services",
    groups: serviceGroups,
    activeHref: "/services",
  },
  { type: "link", href: "/consult", label: "Consult" },
  { type: "link", href: "/blog", label: "Blog" },
  { type: "link", href: "/news", label: "News" },
  {
    type: "cluster",
    label: "Community",
    groups: [{ heading: "", items: communityLinks }],
  },
  { type: "link", href: "/resources", label: "Resources" },
  { type: "link", href: "/store", label: "Store" },
  { type: "link", href: "/events", label: "Events" },
  { type: "link", href: "/pricing", label: "Pricing" },
  { type: "link", href: "/contact", label: "Contact" },
];

export const authLinks: NavLink[] = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Join" },
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
      { href: "/events", label: "Events" },
      { href: "/resources/learning-material", label: "Learning Material" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
    ],
  },
];

export const CONTACT_EMAIL = "hello@eduvoq.com";

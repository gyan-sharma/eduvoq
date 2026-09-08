import {
  bulletList,
  doc,
  heading,
  link,
  paragraph,
  type TipTapNode,
} from "./tiptap";

export type CmsPageSeed = {
  slug: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  bodyJson: TipTapNode;
};

function servicePage(input: {
  slug: string;
  title: string;
  seoDescription: string;
  lead: string;
  detail: string;
}): CmsPageSeed {
  return {
    slug: `services/${input.slug}`,
    title: input.title,
    seoDescription: input.seoDescription,
    bodyJson: doc(
      paragraph(input.lead),
      paragraph(input.detail),
      paragraph(
        "EduVoq consulting is advisory — we do not sell school ERP or SIS software. To discuss a fit for your campus, ",
        link("contact us", "/contact"),
        " or ",
        link("book a consultation", "/consult"),
        ".",
      ),
    ),
  };
}

export const cmsPages: CmsPageSeed[] = [
  {
    slug: "about",
    title: "About Us",
    seoDescription:
      "EduVoq is a professional network and resource hub for school teachers and K-12 stakeholders in India.",
    bodyJson: doc(
      paragraph(
        "EduVoq is a professional network and resource hub for educators with an emphasis on school teachers. We aim to be a vibrant community of professionals involved in pre-school, primary and secondary education — an advertisement-free platform for sharing knowledge and connecting with each other.",
      ),
      paragraph(
        "Parents and students are welcome for educational consultations. Teachers remain at the centre of the community.",
      ),
      heading(2, "Mission", "mission"),
      paragraph(
        "Empower educators and K-12 students with collaboration, innovation, and continuous learning. We do this through consulting sessions, curated learning materials, blogs, forums, education news, and social networking — without turning the platform into an advertisement board.",
      ),
      heading(2, "Vision", "vision"),
      paragraph(
        "A professional-development hub and community-driven education platform for India’s school ecosystem: CBSE, ICSE, IB, Kendriya Vidyalaya, Navodaya, municipal, and state-board institutions.",
      ),
      heading(2, "Founder"),
      paragraph(
        "Pragya Sharma founded EduVoq after a decade of teaching in Delhi Government Schools and Kendriya Vidyalaya. She completed EdLeap (Education Leadership and Management) at IIM Calcutta and holds master’s degrees in literature and education.",
      ),
    ),
  },
  {
    slug: "careers",
    title: "Careers",
    seoDescription:
      "Internships and roles at EduVoq. Send your résumé to hello@eduvoq.com.",
    bodyJson: doc(
      paragraph(
        "EduVoq is a small team building an advertisement-free home for school teachers in India. We occasionally host internships in content, community, and school-operations research.",
      ),
      paragraph(
        "There is no public openings board yet. If you want to work with us, send a short note and your résumé to ",
        link("hello@eduvoq.com", "mailto:hello@eduvoq.com"),
        ". We read every message.",
      ),
      paragraph(
        "You can also use the ",
        link("contact form", "/contact"),
        " and mention “Careers” in your message.",
      ),
    ),
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    seoDescription:
      "How EduVoq collects, uses, and stores personal data. Effective 1 January 2024.",
    bodyJson: doc(
      paragraph(
        "This policy describes how EduVoq (“we”, “us”) handles personal data on EDUVOQ.com. It is written for an India-first service and is DPDP-aware; it is not a claim of full Digital Personal Data Protection Act compliance.",
      ),
      paragraph("Effective date: 1 January 2024."),
      heading(2, "Who we are"),
      paragraph(
        "EduVoq is a professional network, consulting, and content platform for school teachers and K-12 stakeholders. Contact: ",
        link("hello@eduvoq.com", "mailto:hello@eduvoq.com"),
        ".",
      ),
      heading(2, "What we collect"),
      bulletList(
        "Account data: name, email, date of birth (age gate), role, optional profile fields such as school, city, and subjects.",
        "Usage data needed to run the service: sessions, posts, bookings, orders, and security logs.",
        "Messages you send via contact, careers, or blog-submission forms.",
        "Payment references from Razorpay or Stripe (we do not store card PAN or CVV).",
      ),
      heading(2, "Why we collect it"),
      paragraph(
        "We use personal data only to operate the account, community, bookings, orders, and security of EduVoq. We do not sell personal data. We do not share it with advertising affiliates or marketing networks.",
      ),
      heading(2, "Children"),
      paragraph(
        "Anyone under 18 is treated as a child. Children cannot self-register. A parent or guardian creates student accounts and records a parental attestation. Student profiles are not listed in the public directory by default.",
      ),
      heading(2, "Where data lives"),
      paragraph(
        "Application data and files are stored in India on our Bangalore (blr1) host. We keep data only as long as needed for the purpose above, or as Indian tax law requires for invoices.",
      ),
      heading(2, "Your choices"),
      paragraph(
        "You may request an export or deletion of your account from account settings once signed in, or by emailing ",
        link("hello@eduvoq.com", "mailto:hello@eduvoq.com"),
        ". Invoice records may be retained where the law requires.",
      ),
    ),
  },
  {
    slug: "terms",
    title: "Terms and Conditions",
    seoDescription:
      "Terms of use for EDUVOQ.com. Updated 1 January 2024.",
    bodyJson: doc(
      paragraph(
        "These terms govern use of EDUVOQ.com (the “site”), operated by EduVoq. By creating an account or using the public site you agree to them. Updated 1 January 2024.",
      ),
      heading(2, "What EduVoq is"),
      paragraph(
        "EduVoq is a community, consulting, content, and light-commerce platform for educators. It is not a learning management system, school ERP, or examination board. Consulting pages describe advisory services, not software modules.",
      ),
      heading(2, "Accounts"),
      paragraph(
        "You must be 18 or older to create your own account. Keep your login details confidential. We may suspend accounts that abuse the community, evade the age gate, or break the law.",
      ),
      heading(2, "Community and content"),
      paragraph(
        "You are responsible for what you post. Do not publish exam “leaks”, harassment, or other people’s personal data. We may moderate, hide, or remove content and may act on reports.",
      ),
      heading(2, "Consulting and resources"),
      paragraph(
        "Consultations are professional opinions, not clinical, legal, or guaranteed admission outcomes. Downloadable learning material is for entitled members and must not be redistributed as your own product.",
      ),
      heading(2, "Purchases"),
      paragraph(
        "Physical goods and the webinar pack are prepaid. Prices are in Indian rupees. Refunds follow the product or booking terms shown at checkout.",
      ),
      heading(2, "Liability and law"),
      paragraph(
        "The site is provided as available. To the extent permitted by law, EduVoq is not liable for indirect losses. These terms are governed by the laws of India. Questions: ",
        link("hello@eduvoq.com", "mailto:hello@eduvoq.com"),
        ".",
      ),
    ),
  },
  servicePage({
    slug: "school-management",
    title: "School Management",
    seoDescription:
      "Consulting for K-12 school leadership, governance, and academic operations.",
    lead: "EduVoq advises school leaders on governance, academic planning, staff development, and day-to-day operations in Indian K-12 schools.",
    detail:
      "We work with CBSE, ICSE, IB, Kendriya Vidyalaya, and state-board institutions. Engagements typically cover leadership cadence, policy handbooks, and how academic and administrative teams coordinate — not a replacement for your principal or board.",
  }),
  servicePage({
    slug: "infrastructure",
    title: "Infrastructure",
    seoDescription:
      "School infrastructure consulting: campus planning, labs, libraries, and safe facilities.",
    lead: "Campus quality shapes teaching. EduVoq helps schools plan labs, libraries, classrooms, and common areas that are safe, usable, and realistic for Indian budgets.",
    detail:
      "We review capacity, maintenance routines, and phased upgrades so infrastructure decisions support pedagogy instead of becoming unused showpieces.",
  }),
  servicePage({
    slug: "admissions",
    title: "Admissions",
    seoDescription:
      "Admissions consulting for K-12 schools, including policy, counselling, and parent communication.",
    lead: "Admissions is often a school’s first conversation with families. EduVoq helps design transparent policies, counselling scripts, and seat-planning that staff can actually run.",
    detail:
      "We advise on documentation, waitlists, and parent communication. For families, we also offer paid admission consulting sessions through our consult desk.",
  }),
  servicePage({
    slug: "examinations",
    title: "Examinations",
    seoDescription:
      "Examination and assessment consulting for CBSE, ICSE, IB, and other Indian boards.",
    lead: "EduVoq supports schools on internal assessment design, board-exam readiness, and exam integrity — without leaking papers or gaming results.",
    detail:
      "Topics include timetable hygiene around exams, invigilation norms, and how formative assessment should feed teaching. We do not process board results or run an exam engine.",
  }),
  servicePage({
    slug: "timetable",
    title: "Timetable",
    seoDescription:
      "Timetable consulting for teacher load, period design, and room utilisation. Not a generator.",
    lead: "A workable timetable is a staffing and pedagogy problem, not a puzzle app. EduVoq advises schools on period length, teacher load, and room use.",
    detail:
      "We help leadership set constraints and review pain points (clashes, floating periods, PE and lab blocks). We do not ship a timetable generator in this product.",
  }),
  servicePage({
    slug: "sports",
    title: "Sports",
    seoDescription:
      "Consulting for school sports programmes, PE, facilities, and inclusive competition.",
    lead: "EduVoq helps schools build physical-education and sports programmes that include more students, not only the first team.",
    detail:
      "Typical work covers PE periods, facility use, inter-school fixtures, and safeguarding around travel and coaching — aligned with the rest of the school day.",
  }),
  servicePage({
    slug: "seminars",
    title: "Seminars",
    seoDescription:
      "Teacher professional-development seminars and school event design with EduVoq.",
    lead: "Seminars work when they change classroom practice, not when they fill a hall. EduVoq helps schools design teacher PD and guest sessions that fit Indian school calendars.",
    detail:
      "We can advise on themes, speaker briefs, and follow-up. Educators can also join EduVoq webinars through the Webinars and Guidance pack.",
  }),
  servicePage({
    slug: "student-visits",
    title: "Student Visits",
    seoDescription:
      "Consulting for educational visits, institutional trips, and student travel planning.",
    lead: "Student visits should be curriculum-linked and safe. EduVoq advises schools on planning educational trips and institutional visits.",
    detail:
      "We help define learning outcomes, staffing ratios, permissions, and risk notes. We do not operate tours or book transport.",
  }),
  servicePage({
    slug: "cultural-activities",
    title: "Cultural Activities",
    seoDescription:
      "Consulting for school assemblies, festivals, arts programmes, and student voice.",
    lead: "Culture is part of school climate. EduVoq helps design assemblies, festivals, and arts programmes that students can own without exhausting staff.",
    detail:
      "We look at calendar load, house systems, and how cultural work sits beside academics — so events support the school rather than interrupt it.",
  }),
  servicePage({
    slug: "health-safety",
    title: "Health & Safety",
    seoDescription:
      "Student health, safety, and child-protection consulting for K-12 schools.",
    lead: "EduVoq advises schools on student health routines, infirmary protocols, and child-protection practice.",
    detail:
      "Work typically covers sick-bay flow, incident notes, visitor control, and how staff escalate concerns. Psychology consultations for families are booked separately and are not clinical care.",
  }),
  servicePage({
    slug: "government-schemes",
    title: "Government Schemes",
    seoDescription:
      "Advisory on SSA, RMSA, and related Indian school schemes for administrators.",
    lead: "Indian schools sit inside a thicket of schemes — SSA, RMSA, and later programmes. EduVoq helps administrators read what applies to their school and what evidence they should keep.",
    detail:
      "This is orientation and process advice for leadership teams. We are not a grants office and cannot file scheme applications on a school’s behalf.",
  }),
  servicePage({
    slug: "marketing",
    title: "School Marketing",
    seoDescription:
      "School marketing and promotions consulting: admissions outreach without spam tactics.",
    lead: "School marketing should explain the campus honestly. EduVoq advises on admissions outreach, prospectus messaging, and community presence.",
    detail:
      "We help schools choose channels and claims they can stand behind. We do not run paid ad accounts or sell parent data.",
  }),
  servicePage({
    slug: "accounting-taxation",
    title: "Accounting & Taxation",
    seoDescription:
      "Advisory on school finance hygiene, fee processes, and tax compliance — not audit.",
    lead: "EduVoq helps school operators tighten fee processes, books hygiene, and tax documentation so chartered accountants can do their job.",
    detail:
      "This is management advice, not statutory audit or tax representation. GST treatment on our own invoices follows whatever GSTIN the operator has registered.",
  }),
  servicePage({
    slug: "procurement",
    title: "Procurement",
    seoDescription:
      "School procurement consulting for textbooks, labs, stationery, and vendor selection.",
    lead: "Procurement is where quality and leakage meet. EduVoq advises schools on vendor selection, specifications, and simple controls for textbooks, lab equipment, and stationery.",
    detail:
      "We help write what “good enough” looks like and how staff should compare quotes. We do not take supplier commissions.",
  }),
  servicePage({
    slug: "career-counselling",
    title: "Career Counselling",
    seoDescription:
      "Career counselling consulting for schools, plus one-to-one sessions for students and parents.",
    lead: "EduVoq helps schools set up career-counselling practice: subject combinations, board pathways, and conversations with families.",
    detail:
      "Students and parents can also book a one-to-one Career Options and Counselling session. School-wide programmes are scoped as consulting engagements.",
  }),
];

export const cmsPageBySlug: Record<string, CmsPageSeed> = Object.fromEntries(
  cmsPages.map((page) => [page.slug, page]),
);

export const WEBINAR_PACK_FALLBACK = {
  slug: "webinars-guidance",
  name: "Webinars and Guidance",
  pricePaise: 1000,
  durationMonths: 3,
  interval: "once",
  description:
    "Get access to specialised webinars by expert teachers working in International Schools, KVS, and NVS. One-time pack, valid for 3 months. Unlocks webinars only — not the educator resource library.",
};

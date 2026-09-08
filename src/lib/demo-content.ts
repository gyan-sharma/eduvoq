import { Board, Role } from "@prisma/client";

import type { PublicMemberCard } from "@/lib/profile-privacy";

function doc(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: (blocks.length ? blocks : [""]).map((block) => ({
      type: "paragraph",
      content: block ? [{ type: "text", text: block }] : [],
    })),
  };
}

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.UTC(2026, 7, 18, 6, 30, 0);

function daysAgo(n: number): Date {
  return new Date(BASE - n * DAY);
}

export type DemoAuthor = {
  name: string;
  username: string;
  image: null;
};

export const DEMO_AUTHORS = {
  ananya: {
    name: "Ananya Iyer",
    username: "demo-ananya",
    image: null,
  },
  rahul: {
    name: "Rahul Menon",
    username: "demo-rahul",
    image: null,
  },
  meera: {
    name: "Meera Kapoor",
    username: "demo-meera",
    image: null,
  },
} as const satisfies Record<string, DemoAuthor>;

export const DEMO_MEMBERS: PublicMemberCard[] = [
  {
    id: "demo-member-ananya",
    username: DEMO_AUTHORS.ananya.username,
    displayName: DEMO_AUTHORS.ananya.name,
    role: Role.EDUCATOR,
    headline: "PGT Biology · NEP lesson design",
    avatarUrl: null,
    city: "Bengaluru",
    state: "Karnataka",
    boardAffiliation: Board.CBSE,
    schoolName: "Greenfield Public School",
    bio: "Fifteen years in senior-secondary biology. I share unit plans, lab routines, and board-aligned assessments with other teachers.",
    subjects: ["Biology", "EVS"],
    classesTaught: ["Class 11", "Class 12"],
    linkedinUrl: null,
    restricted: false,
  },
  {
    id: "demo-member-rahul",
    username: DEMO_AUTHORS.rahul.username,
    displayName: DEMO_AUTHORS.rahul.name,
    role: Role.EDUCATOR,
    headline: "TGT English · classroom routines",
    avatarUrl: null,
    city: "Pune",
    state: "Maharashtra",
    boardAffiliation: Board.ICSE,
    schoolName: "St. Anne's High School",
    bio: "Middle-school English teacher working on reading workshops and low-prep writing cycles that survive a 35-student section.",
    subjects: ["English"],
    classesTaught: ["Class 6", "Class 7", "Class 8"],
    linkedinUrl: null,
    restricted: false,
  },
  {
    id: "demo-member-meera",
    username: DEMO_AUTHORS.meera.username,
    displayName: DEMO_AUTHORS.meera.name,
    role: Role.EXPERT,
    headline: "Career counsellor · admission advisory",
    avatarUrl: null,
    city: "Delhi",
    state: "Delhi",
    boardAffiliation: Board.CBSE,
    schoolName: null,
    bio: "Independent counsellor. I help families map Class 11 subject choices to realistic undergraduate paths — no private DMs, just the forum and consult bookings.",
    subjects: ["Career counselling"],
    classesTaught: ["Class 10", "Class 11", "Class 12"],
    linkedinUrl: null,
    restricted: false,
  },
];

export const DEMO_FORUM_CATEGORIES = [
  {
    slug: "curriculum-development",
    name: "Curriculum Development",
    description:
      "Share schemes of work, unit plans, and how you adapt the syllabus.",
    threadCount: 2,
  },
  {
    slug: "classroom-management",
    name: "Classroom Management",
    description:
      "Routines, behaviour, grouping, and the day-to-day of a K-12 classroom.",
    threadCount: 1,
  },
  {
    slug: "pedagogical-strategies",
    name: "Pedagogical Strategies",
    description: "How we teach: inquiry, differentiation, NEP-aligned practice.",
    threadCount: 1,
  },
  {
    slug: "assessments-boards",
    name: "Assessments & Boards",
    description: "CBSE, ICSE, IB, and Kendriya Vidyalaya assessment practice.",
    threadCount: 1,
  },
  {
    slug: "career-jobs",
    name: "Career & Jobs",
    description: "Roles, transfers, and professional growth for educators.",
    threadCount: 1,
  },
  {
    slug: "general",
    name: "General",
    description: "Anything else for the EduVoq community.",
    threadCount: 0,
  },
] as const;

export type DemoForumPost = {
  id: string;
  author: DemoAuthor;
  createdAt: Date;
  body: string;
};

export type DemoForumThread = {
  categorySlug: (typeof DEMO_FORUM_CATEGORIES)[number]["slug"];
  slug: string;
  title: string;
  excerpt: string;
  author: DemoAuthor;
  createdAt: Date;
  replyCount: number;
  pinned?: boolean;
  posts: DemoForumPost[];
};

export const DEMO_FORUM_THREADS: DemoForumThread[] = [
  {
    categorySlug: "curriculum-development",
    slug: "nep-unit-plans-without-busywork",
    title: "NEP unit plans that do not become busywork",
    excerpt:
      "We collapsed three overlapping worksheets into one lab notebook checkpoint. Sharing the week-1 map.",
    author: DEMO_AUTHORS.ananya,
    createdAt: daysAgo(4),
    replyCount: 2,
    pinned: true,
    posts: [
      {
        id: "demo-forum-post-1",
        author: DEMO_AUTHORS.ananya,
        createdAt: daysAgo(4),
        body: "We collapsed three overlapping worksheets into one lab notebook checkpoint. The Class 11 ecology unit now has a single artefact students actually keep.\n\nHappy to share the week-1 map if it helps another biology section.",
      },
      {
        id: "demo-forum-post-2",
        author: DEMO_AUTHORS.rahul,
        createdAt: daysAgo(3),
        body: "This is the same problem we had with reading logs. One artefact, collected twice a week, beat a daily checklist that nobody marked.",
      },
    ],
  },
  {
    categorySlug: "curriculum-development",
    slug: "cbse-to-state-board-bridge",
    title: "Bridging a CBSE unit when students arrive from a state board",
    excerpt:
      "Two weeks of vocabulary and diagram conventions before we touch numericals.",
    author: DEMO_AUTHORS.rahul,
    createdAt: daysAgo(9),
    replyCount: 1,
    posts: [
      {
        id: "demo-forum-post-3",
        author: DEMO_AUTHORS.rahul,
        createdAt: daysAgo(9),
        body: "Mid-year joiners from a state board were lost on diagram conventions. We now spend two weeks on vocabulary and labelled sketches before numericals. Scores recovered by the first periodic test.",
      },
    ],
  },
  {
    categorySlug: "classroom-management",
    slug: "entry-routine-for-35",
    title: "A two-minute entry routine that survives 35 students",
    excerpt:
      "Do-now on the board, bags under the bench, pencils already out. No names, just the drill.",
    author: DEMO_AUTHORS.rahul,
    createdAt: daysAgo(2),
    replyCount: 1,
    posts: [
      {
        id: "demo-forum-post-4",
        author: DEMO_AUTHORS.rahul,
        createdAt: daysAgo(2),
        body: "Do-now on the board, bags under the bench, pencils already out. I greet at the door and do not start instruction until the room is still. It took a week to stick.",
      },
    ],
  },
  {
    categorySlug: "pedagogical-strategies",
    slug: "think-pair-share-without-the-noise",
    title: "Think-pair-share without the noise spike",
    excerpt:
      "Written think first, then pair, then two volunteers. The whole-class share stays short.",
    author: DEMO_AUTHORS.ananya,
    createdAt: daysAgo(6),
    replyCount: 1,
    posts: [
      {
        id: "demo-forum-post-5",
        author: DEMO_AUTHORS.ananya,
        createdAt: daysAgo(6),
        body: "Written think first (one sentence in the notebook), then pair, then two volunteers. The whole-class share stays under four minutes and the noise stays in the pair step.",
      },
    ],
  },
  {
    categorySlug: "assessments-boards",
    slug: "competency-items-that-are-not-tricky",
    title: "Competency items that are not just trick questions",
    excerpt:
      "We rewrite one recall item per chapter into a short case. Students see the rubric in advance.",
    author: DEMO_AUTHORS.meera,
    createdAt: daysAgo(11),
    replyCount: 1,
    posts: [
      {
        id: "demo-forum-post-6",
        author: DEMO_AUTHORS.meera,
        createdAt: daysAgo(11),
        body: "We rewrite one recall item per chapter into a short case. Students see the rubric in advance. It is slower to write and faster to mark than a surprise application question on the periodic test.",
      },
    ],
  },
  {
    categorySlug: "career-jobs",
    slug: "tgt-english-mid-year-transfer",
    title: "TGT English — mid-year transfer notes (sample)",
    excerpt:
      "Sample post only. Check the official circular before you apply; this is not a live vacancy.",
    author: DEMO_AUTHORS.meera,
    createdAt: daysAgo(1),
    replyCount: 1,
    posts: [
      {
        id: "demo-forum-post-7",
        author: DEMO_AUTHORS.meera,
        createdAt: daysAgo(1),
        body: "Sample post only. In a live community this is where colleagues share circulars for TGT English mid-year transfers. Always verify on the official portal — EduVoq does not place teachers.",
      },
    ],
  },
];

export type DemoFeedComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { name: string; username: string };
};

export type DemoFeedPost = {
  id: string;
  bodyJson: ReturnType<typeof doc>;
  createdAt: Date;
  author: DemoAuthor;
  comments: DemoFeedComment[];
  commentCount: number;
};

export const DEMO_FEED_POSTS: DemoFeedPost[] = [
  {
    id: "demo-feed-1",
    bodyJson: doc(
      "First week back and the lab still smells of new varnish. If you are rewriting a Class 11 ecology unit this term, I put a one-page week map in the forum.",
    ),
    createdAt: daysAgo(1),
    author: DEMO_AUTHORS.ananya,
    comments: [
      {
        id: "demo-feed-c1",
        body: "Saved. We are doing the same collapse of worksheets.",
        createdAt: daysAgo(1),
        author: {
          name: DEMO_AUTHORS.rahul.name,
          username: DEMO_AUTHORS.rahul.username,
        },
      },
    ],
    commentCount: 1,
  },
  {
    id: "demo-feed-2",
    bodyJson: doc(
      "Reminder: there is no private inbox here. Job circulars belong in Job Alerts, classroom questions in the forum. That is a feature.",
    ),
    createdAt: daysAgo(3),
    author: DEMO_AUTHORS.meera,
    comments: [],
    commentCount: 0,
  },
  {
    id: "demo-feed-3",
    bodyJson: doc(
      "Tried a silent do-now for English period 1. Attendance settled in two minutes. Sharing the prompt set if anyone wants it.",
    ),
    createdAt: daysAgo(5),
    author: DEMO_AUTHORS.rahul,
    comments: [
      {
        id: "demo-feed-c2",
        body: "Yes please — Class 7 would use this tomorrow.",
        createdAt: daysAgo(4),
        author: {
          name: DEMO_AUTHORS.ananya.name,
          username: DEMO_AUTHORS.ananya.username,
        },
      },
    ],
    commentCount: 1,
  },
];

export type DemoGroupPost = {
  id: string;
  body: string;
  createdAt: Date;
  author: DemoAuthor;
  poll?: { question: string; options: string[]; counts: number[] };
};

export type DemoGroup = {
  slug: string;
  name: string;
  description: string;
  isOfficial: true;
  memberCount: number;
  postCount: number;
  posts: DemoGroupPost[];
};

export const DEMO_GROUPS: DemoGroup[] = [
  {
    slug: "job-alerts",
    name: "Job Alerts",
    description:
      "Openings, circulars, and transfer notes for school teachers across boards.",
    isOfficial: true,
    memberCount: 128,
    postCount: 2,
    posts: [
      {
        id: "demo-group-job-1",
        body: "TGT English — sample circular only. In production this is where colleagues paste a Directorate link. Always apply on the official portal.",
        createdAt: daysAgo(2),
        author: DEMO_AUTHORS.meera,
      },
      {
        id: "demo-group-job-2",
        body: "PGT Physics vacancy sample for a Kendriya Vidyalaya. Regular appointment. Comment with the circular if you have it — there is no private inbox.",
        createdAt: daysAgo(8),
        author: DEMO_AUTHORS.ananya,
      },
    ],
  },
  {
    slug: "social-network",
    name: "Social Network",
    description:
      "Share thoughts, classroom practice, and polls with other educators.",
    isOfficial: true,
    memberCount: 214,
    postCount: 2,
    posts: [
      {
        id: "demo-group-social-1",
        body: "What is one routine you will not drop this term, even on a short week?",
        createdAt: daysAgo(3),
        author: DEMO_AUTHORS.rahul,
        poll: {
          question: "Which workshop should we run next?",
          options: ["CBSE competency items", "ICSE lab books", "NEP unit maps"],
          counts: [18, 9, 14],
        },
      },
      {
        id: "demo-group-social-2",
        body: "Brought ladoos for the staff room after the first periodic test. Not pedagogy. Still counts.",
        createdAt: daysAgo(7),
        author: DEMO_AUTHORS.ananya,
      },
    ],
  },
];

export function demoForumAuthor(author: DemoAuthor) {
  return {
    displayName: author.name,
    href: `/members/${author.username}`,
    avatarUrl: null,
  };
}

export function getDemoForumCategory(slug: string) {
  return DEMO_FORUM_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function getDemoForumThreads(categorySlug: string) {
  return DEMO_FORUM_THREADS.filter((thread) => thread.categorySlug === categorySlug);
}

export function getDemoForumThread(categorySlug: string, threadSlug: string) {
  return (
    DEMO_FORUM_THREADS.find(
      (thread) =>
        thread.categorySlug === categorySlug && thread.slug === threadSlug,
    ) ?? null
  );
}

export function getDemoMember(username: string) {
  return DEMO_MEMBERS.find((member) => member.username === username) ?? null;
}

export function getDemoGroup(slug: string) {
  return DEMO_GROUPS.find((group) => group.slug === slug) ?? null;
}

export function isDemoUsername(username: string): boolean {
  return username.startsWith("demo-");
}

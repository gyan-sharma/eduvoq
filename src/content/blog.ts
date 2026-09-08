import {
  bulletList,
  doc,
  heading,
  paragraph,
  type TipTapNode,
} from "./tiptap";

export type BlogTaxonomySeed = {
  slug: string;
  name: string;
};

export type BlogPostSeed = {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
  kind: "BLOG" | "EMAGAZINE";
  publishedAt: string;
  categorySlugs: string[];
  tagSlugs: string[];
  bodyJson: TipTapNode;
};

export const blogCategories: BlogTaxonomySeed[] = [
  { slug: "e-magazine", name: "E-magazine" },
];

export const blogTags: BlogTaxonomySeed[] = [
  { slug: "cbse", name: "CBSE" },
  { slug: "nep-2020", name: "NEP 2020" },
  { slug: "pedagogy", name: "Pedagogy" },
];

export const blogPosts: BlogPostSeed[] = [
  {
    slug: "mastering-the-art-of-lesson-planning",
    title: "Mastering the Art of Lesson Planning",
    excerpt:
      "A workable lesson plan is a timetable decision, not a template. Here is a staffroom method that survives real Indian school days.",
    seoTitle: "Mastering the Art of Lesson Planning",
    seoDescription:
      "Practical lesson-planning advice for school teachers in India — objectives, board constraints, and what to drop when the bell wins.",
    kind: "BLOG",
    publishedAt: "2024-06-12T04:30:00.000Z",
    categorySlugs: [],
    tagSlugs: ["pedagogy", "cbse"],
    bodyJson: doc(
      paragraph(
        "Most lesson-plan formats assume a quiet 40 minutes, one board, and children who have done the homework. Indian classrooms are louder than that. The period may shrink because assembly ran long, a student is called to the office, or the previous teacher overran. A plan that cannot survive those cuts is decoration.",
      ),
      heading(2, "Start from the period you actually have"),
      paragraph(
        "Write the objective in one sentence a colleague could teach from: what students should be able to do by the bell, and how you will know. Then mark a 10-minute core that you will keep even if the period collapses. Everything else is optional extension — extra examples, a worksheet, a closing quiz.",
      ),
      paragraph(
        "For CBSE classes this usually means one skill or one idea, not a chapter. If the period is the only contact you have with that section this week, the core should still leave a written trace in notebooks. That is what revision later can hold on to.",
      ),
      heading(2, "Board, textbook, and your judgement"),
      paragraph(
        "The textbook is a resource, not the period. Map the learning outcome to the board’s language if you must document it, then teach the idea in the order your students can hear it. A plan that copies exercise numbers from the book without a check for understanding will look complete in a file and fail in the room.",
      ),
      bulletList(
        "One objective, one check for understanding, one fallback if the tech or the lab is down.",
        "Names of two students you will specifically listen to — not only the first hands up.",
        "A closer that takes two minutes: an exit sentence, a problem, or a recap pair.",
      ),
      heading(2, "What EduVoq will not do"),
      paragraph(
        "We will not generate fake lesson plans for inspection files. The Resource Corner will carry sample papers and teacher-made plans that have been reviewed. Until then, treat planning as professional judgement: short, dated, and honest about what you actually taught.",
      ),
    ),
  },
  {
    slug: "nep-2020-in-the-classroom",
    title: "NEP 2020 in the Classroom: What a Class Teacher Can Change This Term",
    excerpt:
      "NEP 2020 is a national document. The useful question for a class teacher is smaller: what can change in this section, this term, without waiting for a new circular.",
    seoTitle: "NEP 2020 in the Classroom | EduVoq",
    seoDescription:
      "A class-teacher reading of NEP 2020 for Indian schools — competency checks, reduced rote, and what not to fake for inspection.",
    kind: "BLOG",
    publishedAt: "2024-08-21T04:30:00.000Z",
    categorySlugs: [],
    tagSlugs: ["nep-2020", "cbse", "pedagogy"],
    bodyJson: doc(
      paragraph(
        "Policy documents do not teach period 3. NEP 2020 still matters because principals, boards, and parents now use its vocabulary: competency, foundational literacy, flexibility, holistic report cards. Teachers get asked to show evidence. The risk is theatre — new labels on old worksheets.",
      ),
      heading(2, "Three changes that fit a real timetable"),
      paragraph(
        "First, name the competency in student language before the chapter title. “Can locate a main idea in a short unseen passage” is more honest than “Unit 4”. Second, replace one recall homework a week with a short performance: explain, compare, or make. Third, keep a dated note of who is stuck and what you tried — that is already a better record than a printed rubric nobody used.",
      ),
      paragraph(
        "None of this requires a new ERP. It does require the school to stop treating every period as syllabus coverage. If leadership still counts pages finished, say so in the staff meeting. NEP language on paper and page-counting in the diary is how teachers burn out.",
      ),
      heading(2, "What to refuse"),
      paragraph(
        "Do not invent project files the children did not make. Do not retitle tests as “competency assessments” if the items only check memory. EduVoq’s view is simple: the policy is a direction of travel for Indian school practice, not a branding exercise. Use the parts that improve teaching. Leave the rest for the circular that actually changes your board exam.",
      ),
    ),
  },
  {
    slug: "staffroom-letter-a-quiet-professional-press",
    title: "A Staffroom of One’s Own: Why Teachers Need a Quiet Professional Press",
    excerpt:
      "E-magazine issue: teachers already write — diaries, remarks, WhatsApp voice notes. EduVoq’s e-magazine is for the longer argument that does not fit a circular.",
    seoTitle: "EduVoq E-magazine: A Staffroom of One’s Own",
    seoDescription:
      "EduVoq e-magazine on why school teachers need an advertisement-free place to publish practice, not press releases.",
    kind: "BLOG",
    publishedAt: "2024-11-04T04:30:00.000Z",
    categorySlugs: ["e-magazine"],
    tagSlugs: ["pedagogy"],
    bodyJson: doc(
      paragraph(
        "This piece sits in EduVoq’s e-magazine: longer staffroom writing, not a news brief. Teachers in Indian schools already write constantly — diaries, remark columns, apology messages to parents, notes for a substitute. Almost none of that writing is treated as professional publication. Magazines that do reach schools are often vendor catalogues with a pedagogy column stapled on.",
      ),
      heading(2, "What an educator press is for"),
      paragraph(
        "A professional press is not a marketing blog. It is where a Kendriya Vidyalaya teacher can describe how a multi-grade period actually ran, or a municipal-school colleague can argue about language of instruction without a brand manager in the byline. The standard is usefulness to another teacher, not virality.",
      ),
      paragraph(
        "EduVoq will keep this category advertisement-free. Submissions from members go to review; they are not auto-published. We would rather have twelve careful essays a year than a feed of AI-polished tips that could have been written for any country.",
      ),
      heading(2, "An invitation"),
      paragraph(
        "If you have a practice that survived a real term — not a keynote story — send it. Name the board, the class, and the constraint. Other teachers can take a method they can lift. That is the whole point of an e-magazine for this community.",
      ),
    ),
  },
];

export const blogPostBySlug: Record<string, BlogPostSeed> = Object.fromEntries(
  blogPosts.map((post) => [post.slug, post]),
);

# EduVoq Production Rebuild — Architecture & Product Design

| Field | Value |
| --- | --- |
| **Title** | EduVoq: Greenfield Rebuild of the Wix Public Site into a Self-Hosted Application |
| **Author** | TBD (systems architecture) |
| **Date** | 2026-09-08 |
| **Status** | **Accepted (owner decisions 2026-09-08)** |
| **Audience** | Senior engineers implementing the rebuild |
| **Source of truth for product** | Wix public-site archive at `chalknpencil-archive/` |

---

## Overview

EduVoq is **not an LMS**. It is an India-centric **community + consulting + content + light-commerce platform** for school teachers and K-12 stakeholders, currently published as a Wix site at `https://eduvoq.wixsite.com/chalknpencil` (brand: **EduVoq**, tagline **“Connecting Educators”**). The workspace contains no application source — only a published-site archive (`chalknpencil-archive/meta/README.md`): 54 browser-confirmed public pages, 582 discovered URLs, 68 blog posts, Wix store/booking/groups widgets, and login-walled shells for learning materials, class notes, and member account pages.

This document specifies a **from-scratch, production-grade rebuild** as a single Next.js App Router application, MySQL via Prisma, Auth.js (NextAuth v5), and Caddy as TLS reverse proxy. The product is reconstructed from actual archive routes and copy, then completed where Wix was broken (Forum discontinued), gated (`/learning-material`, `/class-notes`, `/account/*`), or templated (placeholder SKUs, portfolio “project-title-N”, event boilerplate).

The proposed system is a self-hosted monolith: browser → Caddy → Next.js (RSC + Route Handlers + Server Actions) → Prisma → MySQL. **Local/dev** uses Docker Compose (MySQL, MinIO, Mailpit, Caddy). **Production** is the existing DigitalOcean droplet **neojn** (`blr1`, `68.183.85.203`): host Caddy + systemd Next.js on `127.0.0.1:3110` + host MySQL `eduvoq_db` + **local-disk** files. Canonical URL is `https://www.eduvoq.com`. Payments: **Razorpay** (India default) and **Stripe** (international cards). Auth.js uses **JWT sessions + Prisma adapter** (Credentials + Google + Apple + Facebook + LinkedIn). Optional xAI does not block launch.

---

## Background & Motivation

### What EduVoq already is (from the archive)

Homepage copy (`chalknpencil-archive/wget/eduvoq.wixsite.com/chalknpencil.html`):

> EduVoq is a professional network and resource hub for educators with an emphasis on school teachers. It aims to be a vibrant community of professionals involved in pre-school, primary and secondary education with a mission to provide educators an advertisement-free dedicated platform for sharing knowledge and connecting with each other.

About Us (`chalknpencil-archive/wget/eduvoq.wixsite.com/chalknpencil/about-us.html`) states the mission: empower educators and **K-12 students** with collaboration, innovation, and continuous learning — consulting sessions, curated learning materials, blogs, forums, education news, social networking. Vision: a professional-development hub and community-driven education platform.

Founder (same page): **Pragya Sharma** — decade of teaching in Delhi Government Schools and Kendriya Vidyalaya; EdLeap (Education Leadership and Management) from IIM Calcutta; master’s in literature and education.

News meta description (`chalknpencil-archive/rendered/chalknpencil__news.html`): “premier networking platform exclusively for school teachers”; “Parents and students are welcome for educational consultations.”

India-centric content is explicit: blog tags include `cbse`, `icse`, `international-baccalaureate-ib`, `kendriya-vidyalaya`, `municipal-school`, `nep-2020` topics; school-ops pages cover SSA/RMSA and Indian school administration; locale in Wix viewer model is `en-in`; store currency is **INR**.

### Current state and pain points

| Pain | Evidence | Consequence |
| --- | --- | --- |
| Hosted on Wix, not owned | Archive README; Wix ads banner on every page | No source, no schema, no deploy control, Wix branding |
| Forum is dead | Homepage: “Wix Forum is no longer available”; `/forum` is a shell (`forum-sitemap.xml` 404s) | Core promised feature missing |
| Member content not exportable | `/learning-material`, `/class-notes`, `/account/my-account` are empty HTML shells | Must design resources/account from product intent, not migrate data |
| Store is half-template | Real SKUs: Student's Diary ₹188, Time-table Arrangement Register ₹300; plus **10** placeholders `i-m-a-product-2` … `i-m-a-product-11` | Rebuild a real catalog; do not clone placeholders |
| Bookings/store call live Wix APIs | Archive limitation #7 | Availability, orders, payments must be first-class in our DB |
| Member profiles 404 | 112 failures, mostly `member-profile` sitemap URLs | Do not rebuild ghost profiles |
| Portfolio is a Wix template | `/portfolio` copy: “Welcome to my portfolio…”; collections named `my-portfolio/project-title-1` with hotel-model photos | Not a real EduVoq feature as published |
| Pricing widget is JS-hydrated | `/plans-pricing` renders “Webinars and Guidance ₹10 / every month / valid 3 months” | Must re-implement subscriptions ourselves |
| Child-safety unaddressed | K-12 students invited; privacy policy is generic Wix-era text (effective 2024-01-01) | DPDP (India) requires verifiable parental consent for children |

### Why rebuild now

The archive is a **preservation snapshot of the published site**, not a CMS export. Continuing on Wix means a discontinued forum, un-exportable member data, placeholder commerce, and no path to a real resource library. A self-hosted Next.js app lets EduVoq own identity, content, bookings, payments, and (later) AI assistants for teachers.

---

## Goals & Non-Goals

### Goals (v1 product)

1. Public marketing site with the same information architecture as the Wix nav, using clean URLs.
2. Auth, profiles, RBAC, and a member account area covering the Wix account surfaces that existed.
3. Community: members directory, social feed, groups (Job Alerts + Social Network as seeds), **a real forum**, followers, notifications.
4. CMS: blogs (migrate 68 posts), e-magazine category, tags, user-submitted blogs with moderation, news, RSS, SEO.
5. Expert consultation: three services from the booking sitemap, calendar, bookings, expert availability, payments.
6. Learning resources: Learning Material, Class Notes, Sample Papers / Lesson Plans — upload, board/class/subject taxonomy, access control. **v1 entitlement:** verified `EDUCATOR` / `EXPERT` / `STAFF` / `ADMIN` get the `EDUCATOR_ONLY` library; the paid webinar pack does **not** gate that library. `/sample-papers` is a public teaser; file download requires login + entitlement.
7. Commerce: **two migrated physical SKUs** (Student's Diary ₹188, Time-table Arrangement Register ₹300) plus cart/checkout/orders/addresses. Guest checkout is **out**. **PHYSICAL is on** (`commerce_physical=true`): self-ship India, prepaid only, two flat shipping bands (metro ₹79 / rest of India ₹129). Extra SKUs only if later priced.
8. Events: list + detail + optional registration (seed two archive events only if copy is rewritten; do not ship Wix boilerplate descriptions).
9. Admin/CMS/ops: content, moderation, bookings, orders, users, flags, basic analytics.
10. Production deploy on **neojn**: host Caddy site + systemd unit + `eduvoq_db` + local disk storage. Docker Compose is **dev only**.
11. Content migration scripts from the Wix archive for public pages and blog posts that actually have copy.
12. Child-safety **age gate** on every signup path (credentials **and all OAuth providers**), parent-created student accounts, and recorded parental attestation. This is **DPDP-aware, not cryptographically verifiable parental consent** (see Security).

### Non-Goals

- Pixel-perfect Wix visual clone (Wix fonts, Thunderbolt layout, freemium banner).
- Wix editor, Wix Members, Wix Stores, Wix Bookings, Wix Groups, Wix Pricing Plans as integrations.
- Cloning placeholder SKUs `product-page/i-m-a-product-{2–11}`.
- Rebuilding 404 member profiles from `member-profile_p_first-chunk-sitemap.xml`.
- Cloning Wix Pro Gallery portfolio (`/portfolio`, `/portfolio-collections/my-portfolio/project-title-N`) as a public marketing feature. Rationale: archive copy is generic template (“Welcome to my portfolio. Here you’ll find a selection of my work.”); images are stock hotel-model photos (`portfolio-collections-sitemap.xml` titles like `Hotels-Models14015`). Educator **profile portfolios** (bio, posts, resources) *are* in scope; the gallery app is not.
- School ERP / SIS: timetable engine, attendance, fee collection, exam processing. School-ops pages are **consulting landing pages**, not software modules. v1 does not build a working timetable generator.
- Native mobile apps (Wix had a mobile-app invite banner — ignore).
- Rebuilding Wix cruft routes: `/blank-1`, `/copy-of-home`, `/general-4`, `/popup-si38k`, `/popup-si38l`, `/fullscreen-page`, `/profile-1`, `/schedule` (empty).
- Making the product depend on AI. AI is an optional module (see §AI).
- PostgreSQL, nginx, or Auth0 as the primary stack.

---

## Feature Inventory (from archive, not invented)

Nav labels extracted from homepage SITE_CONTAINER. Footer: About Us, Mission & Vision, Blogs & Articles, Careers, Teacher Social, EduVoq Forums, Community Members, Contact Us, Consulting Services, Learning Material.

### 1. Public marketing site

| Wix route | Title (browser-pages.json / HTML) | Archive path | Rebuild as |
| --- | --- | --- | --- |
| `/` | Home \| EduVoq - Connecting Educators | `wget/.../chalknpencil.html` | `/` |
| `/about-us` | About Us \| EduVoq | `wget/.../about-us.html` | `/about` |
| `/contact` | Contact \| EduVoq — `hello@eduvoq.com` | `wget/.../contact.html` | `/contact` |
| `/careers` | Careers \| EduVoq — internships, resume to hello@ | `wget/.../careers.html` | `/careers` |
| `/news` | News \| EduVoq | `rendered/chalknpencil__news.html` | `/news` |
| `/privacy-policy` | Privacy Policy \| EduVoq (effective 2024-01-01) | `rendered/chalknpencil__privacy-policy.html` | `/privacy` |
| `/tnc` | Terms and Conditions \| EduVoq (updated 2024-01-01; mentions EDUVOQ.com) | `wget/.../tnc.html` | `/terms` |
| `/site-map` | Sitemap | `pages-sitemap.xml` | `/sitemap` (HTML) + `/sitemap.xml` |
| `/plans-pricing` | Plans & Pricing \| EduVoq | `rendered/chalknpencil__plans-pricing.html` | `/pricing` |
| `/thank-you-page` | Thank you | urls-content.txt | `/thank-you` |

**School Administration** (consulting landings — long-form copy + poems + how-we-help CTAs to contact/consult):

| Wix route | Title | Rebuild |
| --- | --- | --- |
| `/school-management` | School Management \| EduVoq | `/services/school-management` |
| `/school-infrastructure` | School Infrastructure \| EduVoq | `/services/infrastructure` |
| `/admissions` | Admissions \| EduVoq | `/services/admissions` |
| `/examination` | Examination \| EduVoq | `/services/examinations` |
| `/time-table-management` | Time Table \| EduVoq | `/services/timetable` |
| `/sports` | Sports \| EduVoq | `/services/sports` |
| `/government-schemes` | Government Schemes \| EduVoq (SSA, RMSA, …) | `/services/government-schemes` |
| `/seminars` | Seminars \| EduVoq | `/services/seminars` |
| `/student-visits` | Student Visits \| EduVoq | `/services/student-visits` |
| `/cultural-activities` | Cultural Activities \| EduVoq | `/services/cultural-activities` |
| `/copy-of-cultural-activities` | **Marketing \| EduVoq** (meta: School Marketing and Promotions) | `/services/marketing` |
| `/accounting-and-taxation` | Accounting and Taxes \| EduVoq | `/services/accounting-taxation` |
| `/procurement` | Procurement \| EduVoq | `/services/procurement` |
| `/student-health-and-safety` | Student Health and Safety \| EduVoq | `/services/health-safety` |
| `/career-counselling` | Career Counselling \| EduVoq | `/services/career-counselling` |
| `/expert-consultation` | Expert Consultation \| EduVoq — “Our Services” | `/consult` |

### 2. Auth, identity, accounts

Wix member surfaces (`urls-content.txt` + warmup-data labels):

- Warmup JSON uses `/account/my-*` (my-account, my-addresses, my-orders, my-bookings, my-posts, my-subscriptions, my-wallet, notifications, settings).
- `urls-content.txt` also lists site-root aliases: `/my-account`, `/my-addresses`, `/my-orders`, `/my-bookings`, `/my-posts`, `/my-subscriptions`, `/my-wallet`. Rebuild consolidates under `/account/*`; **301 both** Wix shapes.
- `/profile/{username}/profile`, `/followers`, `/forum-posts`, `/forum-comments`
- Login social bar on every page

Working profiles in browser crawl: `profile/educonnectglobal-blog`, `profile/chamolidevesh` (Devesh Chamoli). Most sitemap member profiles 404 — do not migrate.

### 3. Social network & community

- `/members` — page title **Educators | EduVoq** (meta description: “Community Members - EduVoq”)
- `/social-network` — “Social Network for Educators”; copy: “Join groups of your choice, share thoughts and interact with others”; Wix Groups composer (posts, media, polls)
- Groups: `/group/job-alerts` (3 discussions), `/group/social-network` (6 discussions)
- `/forum` — promised on homepage (curriculum development, classroom management, pedagogical strategies) but **Wix Forum discontinued**
- `/notifications`

### 4. CMS

- `/blog` — 68 posts in `meta/sitemaps/blog-posts-sitemap.xml` (Mar–Dec 2024)
- `/blog/categories/e-magazine`
- `/blog/tags/{tag}` — 83 tags (`urls-content.txt`)
- `/post/{slug}` — individual posts (Wix Blog TPA)
- `/submit-your-blog` — “Submit your Blog Posts and Articles to EduVoq for getting them published”; form + `hello@eduvoq.com`
- `/news`
- `/blog-feed.xml` — RSS exists

### 5. Expert consultation & bookings

`meta/sitemaps/booking-services-sitemap.xml` (lastmod 2024-12-04):

| Service | Duration (service-page HTML) | Location shown |
| --- | --- | --- |
| Admission Consulting & Advisory | 2 hr | Customer's Place |
| Career Options and Counselling | 1 hr | Customer's Place |
| Psychology Consultation | 1 hr | Customer's Place |

Also: `/booking-calendar`, `/booking-form`, `/my-bookings`. Expert landing invites contributors at `hello@eduvoq.com`.

### 6. Learning resources (login-walled)

| Wix route | Title | Notes |
| --- | --- | --- |
| `/learning-material` | EduVoq (empty shell) | Member-only; homepage promises “rich library of resources” |
| `/class-notes` | EduVoq (empty shell) | Member-only |
| `/sample-papers` | **Lesson Plans \| EduVoq** — meta: “Sample Papers and Examination Guidance” | **Public teaser listing** (titles, board/class filters). File download is login + `EDUCATOR_ONLY` entitlement. Same page also lists `LESSON_PLAN` kind. |

Nav label for this cluster: **Resource Corner** / “Syllabus and Question Paper”.

### 7. Commerce

- `/category/all-products` — All Products
- `/cart-page`, `/checkout`
- Real products (`store-products-sitemap.xml`):
  - `/product-page/student-s-diary` — Student's Diary, **₹188.00 INR**, SKU `364215375135191`. Copy: academic planning diary for students.
  - `/product-page/time-table-arrangement-register` — Time-table Arrangement Register, **₹300.00 INR**, SKU `364215376135191`. Copy: quality-paper register for educators and students.
- Placeholders (**10** SKUs): `i-m-a-product-2` … `i-m-a-product-11` — **discard**.
- Account: orders, addresses, wallet, subscriptions.

### 8. Events

`event-pages-sitemap.xml`:

- `/event-details/annual-science-fair` — template description (“I’m an event description…”)
- `/event-details/spring-is-here-field-trip` — same boilerplate
- `/event-list`

Rebuild the **feature** (events + registration). Do not publish Wix placeholder copy. Seed real EduVoq events (webinars, teacher seminars) at launch.

### 9. Portfolio decision

**Non-goal as a public gallery.** Rebuild as **Educator / school profile portfolio**: publications, uploaded resources, consultation services, about. No `project-title-N` routes.

### 10. Plans & pricing (hydrated widget)

From `/plans-pricing` visible text:

- Heading: “Choose your pricing plan”
- Plan name: **Webinars and Guidance**
- Price: **₹10 every month**
- Benefit: “Get access to specialised webinars by expert teachers working in International Schools, KVS, NVS”
- Validity: **3 months**
- CTA: Buy Now

v1 implements this as a **one-time 3-month pack at ₹10** (likely a Wix widget misconfiguration at that price; owner may override). It unlocks **webinars**, not the educator resource library. No Razorpay Subscriptions API in v1. Free accounts remain the default.

---

## Proposed Design

### System architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser[Browser]
    Crawler[Search / RSS]
  end

  subgraph edge [Edge / TLS]
    Caddy[Host Caddy on neojn<br/>www.eduvoq.com → 127.0.0.1:3110]
  end

  subgraph app [Next.js 16.3 App Router - standalone]
    RSC[Server Components / SSR]
    Actions[Server Actions]
    RH[Route Handlers /api]
    Proxy[proxy.ts auth gate]
    Cron[GET /api/cron]
  end

  subgraph data [Data plane]
    Prisma[Prisma Client]
    MySQL[(Host MySQL eduvoq_db)]
    Disk[Local disk /var/www/eduvoq/storage]
    MinIO[(MinIO - Compose dev only)]
  end

  subgraph side [Sidecars]
    SMTP[SMTP]
    Razorpay[Razorpay India]
    Stripe[Stripe international]
    XAI[xAI API optional]
  end

  Browser --> Caddy
  Crawler --> Caddy
  Caddy --> app
  Proxy --> RSC
  RSC --> Prisma
  Actions --> Prisma
  RH --> Prisma
  Prisma --> MySQL
  RH -->|stream after ACL| Disk
  Actions -->|write| Disk
  RH -.->|dev FILE_DRIVER=s3| MinIO
  RH --> SMTP
  RH --> Razorpay
  RH --> Stripe
  Actions -.-> XAI
  Cron --> Prisma
  Cron --> SMTP
```

**Request path (prod):** Host Caddy on neojn terminates TLS and reverse-proxies `www.eduvoq.com` → `127.0.0.1:3110`. Next.js renders marketing/CMS as RSC; mutations via Zod-validated Server Actions; webhooks/cron/files via Route Handlers. Prisma talks to **localhost MySQL `eduvoq_db`**. Files in production are **local disk** (`FILE_DRIVER=local`, `/var/www/eduvoq/storage`, owner `www-data`, not world-readable); `GET /api/files/[id]` checks ACL/entitlement then streams. MinIO is **dev Compose only**. Public assets still go through the same handler (cacheable); private PDFs never have a world-readable URL.

**Dev:** Compose Caddy :80 → `app:3000`; MySQL + MinIO + Mailpit. Same Next.js code; `FILE_DRIVER=s3` locally.

**Why no separate Nest API:** one deployable, shared types, Server Actions colocated with UI, fewer auth cookies. Scale-out is multiple Next replicas behind Caddy + MySQL primary. Revisit a split only if background work outgrows `/api/cron`.

### Repo structure (single Next.js app)

```
/
  package.json                 # pnpm, Next 16.3, Prisma, Auth.js
  docker-compose.yml
  docker-compose.prod.yml
  Dockerfile                   # multi-stage, output: standalone
  Caddyfile                    # local (imported by compose)
  caddy/
    Caddyfile.local
    Caddyfile.prod
  prisma/
    schema.prisma
    seed.ts
    migrations/
  scripts/
    migrate-wix/               # HTML/JSON extraction from archive
  src/
    app/                       # App Router routes
    proxy.ts                   # Next 16 auth/rate-limit gate (Node runtime)
    auth.ts                    # Auth.js config
    server/
      db.ts                    # Prisma singleton
      rbac.ts
      actions/                 # domain Server Actions
      jobs/                    # cron handlers
    components/                # shadcn + domain UI
    lib/
      validators/              # Zod
      payments/razorpay.ts
      storage/s3.ts
      email/
      ai/                      # optional xAI
    content/                   # MDX fallback for legal if needed
  e2e/                         # Playwright
  tests/                       # Vitest
```

Monorepo is unjustified for one product, one team, one deployable.

### Load assumptions and targets

Conservative launch (matches a small educator community, not a national LMS):

| Metric | v1 assumption | 12-month stretch |
| --- | --- | --- |
| Educators | 200–500 MAU | 2,000 |
| Students / parents | 0–200 (gated) | 2,000 |
| Concurrent sessions | < 50 | < 300 |
| Blog corpus | 68 migrated + ~5/month | ~150 |
| Learning files | 1–5 GB | 50 GB |
| Product images + media | < 2 GB (archive images ~hundreds of files; videos ~1.1 GiB if reused) | 20 GB |

**Latency targets (p95, India, origin):**

- Public marketing/blog SSR: **≤ 400 ms** TTFB on warm cache
- Authenticated RSC (account, feed): **≤ 600 ms**
- List endpoints (blog index, slot list, resource index): **≤ 300 ms**
- Checkout order create: **≤ 800 ms** excluding Razorpay redirect
- File download (presign redirect or stream start): **≤ 200 ms**

v1 has **no site-wide search API**. Blog/resource/member lists are paginated cursor queries (`id`/`publishedAt`), not full-text search UX. `@@fulltext` on `Post` is reserved for a later `/api/search` PR.

**Availability:** 99.5% monthly (single VPS is acceptable; document backup RPO 24h / RTO 4h).

**MySQL sizing:** start `mysql:8.4` with 1 GB InnoDB buffer; expect < 5 GB data year one excluding blobs (blobs live in MinIO).

---

## API / Interface Changes

Greenfield — no existing app APIs. Surface area:

1. **Server Actions** for all cookie-authenticated mutations (forms).
2. **Route Handlers** for: Auth.js, Razorpay **and Stripe** webhooks, cron, RSS, sitemap, health, file stream/presign, public JSON (e.g. booking slots).
3. **RSC pages** for reads.

### TypeScript domain sketches

```ts
// src/lib/types/user.ts
export type Role =
  | "ADMIN"
  | "STAFF"
  | "EDUCATOR"
  | "EXPERT"
  | "STUDENT"
  | "PARENT"; // matches Prisma enum Role; default public signup is EDUCATOR

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  avatarFileId: string | null;
  headline: string | null;
  boardAffiliation: string | null; // CBSE / ICSE / IB / KV / State
  createdAt: string;
}

export interface Profile extends UserPublic {
  bio: string | null;
  schoolName: string | null;
  city: string | null;
  state: string | null;
  subjects: string[];
  classesTaught: string[];
  linkedinUrl: string | null;
  isPublic: boolean;
}

export type UserStatus =
  | "PENDING_VERIFICATION"
  | "PENDING_PROFILE" // Google (or incomplete) until DOB + TOS
  | "ACTIVE"
  | "SUSPENDED"
  | "BANNED";

export interface SessionUser {
  id: string;
  role: Role;
  status: UserStatus;
  tokenVersion: number;
  email: string;
  username: string | null;
  emailVerified: Date | null;
  dateOfBirth: string | null; // ISO date
  parentId: string | null;
}
```

```ts
// src/lib/types/booking.ts
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type ConsultationMode = "ONLINE" | "CUSTOMER_PLACE" | "EXPERT_PLACE";

export interface ConsultationService {
  id: string;
  slug: string;
  title: string;
  durationMinutes: number;
  pricePaise: number; // INR minor units
  mode: ConsultationMode;
  expertId: string | null; // null = any available expert
}

export interface Booking {
  id: string;
  serviceId: string;
  expertId: string;
  customerId: string;
  startsAt: string; // ISO, stored UTC, generated in Asia/Kolkata
  endsAt: string;
  status: BookingStatus;
  meetingUrl: string | null; // Meet/Zoom; required when mode=ONLINE and CONFIRMED
  razorpayOrderId: string | null;
  notes: string | null;
}
```

```ts
// src/lib/types/content.ts
export type PostStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED";
export type PostKind = "BLOG" | "NEWS" | "EMAGAZINE" | "SUBMISSION";

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyJson: unknown; // TipTap JSON
  kind: PostKind;
  status: PostStatus;
  authorId: string;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  coverFileId: string | null;
  categoryIds: string[];
  tagIds: string[];
}
```

```ts
// src/lib/types/commerce.ts
export type ProductType = "PHYSICAL" | "DIGITAL";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface Product {
  id: string;
  slug: string;
  name: string;
  descriptionJson: unknown;
  type: ProductType;
  pricePaise: number;
  currency: "INR";
  sku: string;
  stock: number | null; // null = digital / unlimited
  categoryId: string;
}

export interface CartItemView {
  productId: string;
  qty: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  subtotalPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  currency: "INR";
  invoiceNumber: string | null;
  buyerGstin: string | null;
  shippingAddressId: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  items: Array<{
    productId: string;
    qty: number;
    unitPaise: number;
    taxPaise: number;
    hsnSac: string | null;
  }>;
}
```

### Server Actions catalog (key procedures)

All actions: `z.object` input → `requireSession()` / `requireRole()` → mutate → revalidatePath. CSRF is Auth.js cookie + Next Server Action origin check; still set `AUTH_SECRET` and Caddy to same-site.

`requireSession()` is **not** JWT-only. It reads the JWT, then `findUnique`s `User.status` and `tokenVersion` from MySQL (see Auth model). Ban / password reset take effect on the next Server Action, not after 14 days.

| Domain | Action | Auth | Notes |
| --- | --- | --- | --- |
| Auth | `registerWithCredentials` | public | **Age gate in this action** (PR 04). DOB required. Under-18 blocked. Role EDUCATOR or PARENT only. |
| Auth | `completeProfile` | session, `PENDING_PROFILE` | Google users: DOB + TOS before `ACTIVE` |
| Auth | `linkGoogleAccount` / `linkCredentials` | self | Same verified email; `allowDangerousEmailAccountLinking: false` |
| Auth | `requestPasswordReset` / `resetPassword` | public, rate-limited | |
| Auth | `verifyEmail` | token | |
| Profile | `updateProfile`, `updateSettings` | self | Username immutable after 14 days (`usernameChangedAt`) |
| Follow | `followUser` / `unfollowUser` | member | Students cannot follow arbitrary adults |
| CMS | `createPostDraft`, `updatePost`, `submitForReview` | educator+ | |
| CMS | `moderatePost` | staff/admin | |
| Forum | `createThread`, `replyThread`, `react`, `reportContent` | member | `Reaction`, `Report` tables |
| Groups | `joinGroup`, `createGroupPost`, `createPoll`, `votePoll` | member | `PollVote` unique per user+post |
| Social | `createFeedPost`, `createComment` | member | No DMs / no inbox |
| Booking | `listSlots` (RH GET), `createBooking`, `cancelBooking` | member | Tx + `@@unique([expertId, startsAt])`; Razorpay if `pricePaise > 0` |
| Expert | `setAvailability`, `completeBooking`, `setMeetingUrl` | expert | |
| Resources | `uploadResource`, `updateResourceMeta` | educator/staff | MIME allowlist + size cap; `status=IN_REVIEW` unless staff |
| Resources | `requestDownload` | entitled | Inserts `ResourceDownload`; returns local stream URL or 60s S3 presign |
| Commerce | `addToCart`, `updateCart`, `placeOrder` | **member only** | DB `Cart`/`CartItem`; no guest cart |
| Wallet | `initiateWalletTopup` | member | Flag `wallet_spend` off |
| Events | `registerForEvent` | member | |
| Contact | `submitContact`, `submitBlogPitch`, `submitCareer` | public | Honeypot + Cloudflare Turnstile |
| Admin | `setFeatureFlag`, `banUser`, `refundOrder`, `grantExpertRole` | admin | Audit log. Experts are **admin-granted** after `hello@eduvoq.com` application. |

Public Route Handlers: `GET /api/health`, `GET /api/ready`, `GET /rss.xml`, `GET /sitemap.xml`, `POST /api/webhooks/razorpay`, `POST /api/webhooks/stripe`, `GET /api/cron`, `GET /api/slots?serviceId&from&to`, `GET /api/files/[id]` (ACL + stream or presign).

---

## Data Model Changes

Greenfield schema. Prisma MySQL provider. IDs: `cuid()`. Money: `Int` paise. Time: `DateTime` UTC; display `Asia/Kolkata`. **PR 03 ships this full schema** (unused tables are fine; one `prisma validate` + one initial migration). Files are **polymorphic only** (`FileObject.ownerType` + `ownerId`) — no `Product.images FileObject[]` back-relation.

The outline below is the implementable shape. Every `String` FK that is a relation has `@relation`. Prisma `@@unique` on optional `username` allows multiple SQL NULLs (MySQL InnoDB).

### Enums

Prisma requires **one enum value per line**. Do not paste compact `enum Role { ADMIN STAFF ... }` — `prisma validate` fails with P1012.

```prisma
enum Role {
  ADMIN
  STAFF
  EDUCATOR
  EXPERT
  STUDENT
  PARENT
}

enum UserStatus {
  PENDING_VERIFICATION
  PENDING_PROFILE
  ACTIVE
  SUSPENDED
  BANNED
}

enum PostKind {
  BLOG
  NEWS
  EMAGAZINE
  SUBMISSION
}

enum PostStatus {
  DRAFT
  IN_REVIEW
  PUBLISHED
  REJECTED
  ARCHIVED
}

enum ResourceKind {
  LEARNING_MATERIAL
  CLASS_NOTES
  SAMPLE_PAPER
  LESSON_PLAN
  SYLLABUS
  OTHER
}

enum ResourceStatus {
  IN_REVIEW
  PUBLISHED
  REJECTED
}

enum ResourceVisibility {
  PUBLIC
  SUBSCRIBER
  EDUCATOR_ONLY
}

enum Board {
  CBSE
  ICSE
  IB
  STATE_BOARD
  KVS
  NVS
  OTHER
}

enum BookingStatus {
  PENDING_PAYMENT
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

enum ConsultationMode {
  ONLINE
  CUSTOMER_PLACE
  EXPERT_PLACE
}

enum ProductType {
  PHYSICAL
  DIGITAL
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  FULFILLING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentProvider {
  RAZORPAY
  STRIPE
  WALLET
  FREE
}

enum PaymentKind {
  ORDER
  BOOKING
  PLAN_PACK
  WALLET_TOPUP
  EVENT
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELED
}

enum NotificationType {
  FOLLOW
  BOOKING
  COMMENT
  REPLY
  MODERATION
  ORDER
  SYSTEM
  GROUP
  FORUM
}

enum FileOwnerType {
  USER
  POST
  PRODUCT
  RESOURCE
  SERVICE
  EVENT
  CMS
}

enum FileAcl {
  PUBLIC
  PRIVATE
}

enum ConsentType {
  TOS
  PRIVACY
  PARENTAL_ATTESTATION
  MARKETING
}

enum ReportStatus {
  OPEN
  DISMISSED
  ACTIONED
}

enum CronJobName {
  REMINDERS
  UNPAID_TIMEOUT
  DIGEST
  SUB_EXPIRY
}
```

### Auth.js required models (MySQL)

Follow Auth.js Prisma adapter MySQL schema, then extend `User`.

```prisma
model User {
  id                 String     @id @default(cuid())
  name               String?    @db.VarChar(191)
  email              String     @unique
  emailVerified      DateTime?
  image              String?
  passwordHash       String?
  // Optional so Google createUser cannot fail uniqueness; adapter generateUsername()
  // runs BEFORE insert. Unique allows multiple NULLs in MySQL.
  username           String?    @unique @db.VarChar(32)
  usernameChangedAt  DateTime?
  role               Role       @default(EDUCATOR)
  status             UserStatus @default(PENDING_VERIFICATION)
  dateOfBirth        DateTime?  @db.Date
  parentId           String?
  parent             User?      @relation("ParentChildren", fields: [parentId], references: [id])
  children           User[]     @relation("ParentChildren")
  headline           String?    @db.VarChar(191)
  bio                String?    @db.Text
  schoolName         String?    @db.VarChar(191)
  city               String?    @db.VarChar(96)
  state              String?    @db.VarChar(96)
  boardAffiliation   Board?
  subjects           Json?
  classesTaught      Json?
  linkedinUrl        String?
  isProfilePublic    Boolean    @default(true)
  tokenVersion       Int        @default(0) // increment on ban / password reset; JWT must match
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  accounts           Account[]
  sessions           Session[] // unused at runtime (JWT strategy); kept for adapter
  profile            Profile?
  posts              Post[]
  comments           Comment[]
  follows            Follow[]   @relation("follower")
  followers          Follow[]   @relation("following")
  bookingsAsCustomer Booking[]  @relation("customer")
  bookingsAsExpert   Booking[]  @relation("expert")
  expertAvailability ExpertAvailability[]
  orders             Order[]
  cart               Cart?
  addresses          Address[]
  notifications      Notification[]
  resources          Resource[]
  resourceDownloads  ResourceDownload[]
  consents           Consent[]
  auditEvents        AuditEvent[]
  forumThreads       ForumThread[]
  forumPosts         ForumPost[]
  groupMemberships   GroupMember[]
  groupPosts         GroupPost[]
  feedPosts          FeedPost[]
  reactions          Reaction[]
  reportsFiled       Report[]   @relation("reporter")
  pollVotes          PollVote[]
  subscriptions      Subscription[]
  wallet             WalletAccount?
  eventRegistrations EventRegistration[]
  filesUploaded      FileObject[]

  @@index([role, status])
  @@index([parentId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

### Profiles, follows, notifications

```prisma
model Profile {
  id        String  @id @default(cuid())
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  coverFileId String?
  portfolio Json?   // structured extras
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following   User @relation("following", fields: [followingId], references: [id], onDelete: Cascade)
  @@id([followerId, followingId])
  @@index([followingId])
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String?          @db.Text
  href      String?
  readAt    DateTime?
  createdAt DateTime         @default(now())
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt, createdAt])
}
```

### CMS, comments, pages

```prisma
model Post {
  id             String     @id @default(cuid())
  slug           String     @unique @db.VarChar(191)
  title          String     @db.VarChar(255)
  excerpt        String     @db.Text
  bodyJson       Json
  bodyText       String     @db.LongText // search/plain
  kind           PostKind
  status         PostStatus @default(DRAFT)
  authorId       String
  author         User       @relation(fields: [authorId], references: [id])
  coverFileId    String?
  seoTitle       String?
  seoDescription String?    @db.VarChar(320)
  publishedAt    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  categories     PostCategory[]
  tags           PostTag[]
  comments       Comment[]
  @@index([status, kind, publishedAt])
  @@fulltext([title, bodyText])
}

model Category {
  id    String @id @default(cuid())
  slug  String @unique // e-magazine, news, pedagogy
  name  String
  posts PostCategory[]
}

model Tag {
  id    String @id @default(cuid())
  slug  String @unique
  name  String
  posts PostTag[]
}

model PostCategory {
  postId     String
  categoryId String
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([postId, categoryId])
}

model PostTag {
  postId String
  tagId  String
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([postId, tagId])
}

model Comment {
  id        String   @id @default(cuid())
  postId    String?
  threadId  String?
  feedPostId String?
  parentId  String?
  authorId  String
  body      String   @db.Text
  status    String   @default("VISIBLE") // VISIBLE HIDDEN SPAM
  createdAt DateTime @default(now())
  author    User     @relation(fields: [authorId], references: [id])
  post      Post?    @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@index([postId, createdAt])
}

model CmsPage {
  id             String   @id @default(cuid())
  slug           String   @unique // about, privacy, services/marketing
  title          String
  bodyJson       Json
  seoTitle       String?
  seoDescription String?
  published      Boolean  @default(true)
  updatedAt      DateTime @updatedAt
}
```

### Forum, groups, social feed

```prisma
model ForumCategory {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?  @db.Text
  sortOrder   Int      @default(0)
  threads     ForumThread[]
}

model ForumThread {
  id         String   @id @default(cuid())
  categoryId String
  authorId   String
  title      String
  slug       String
  pinned     Boolean  @default(false)
  locked     Boolean  @default(false)
  createdAt  DateTime @default(now())
  category   ForumCategory @relation(fields: [categoryId], references: [id])
  author     User          @relation(fields: [authorId], references: [id])
  posts      ForumPost[]
  @@unique([categoryId, slug])
  @@index([categoryId, createdAt])
}

model ForumPost {
  id        String   @id @default(cuid())
  threadId  String
  authorId  String
  parentId  String?  // flat replies; null = top-level
  bodyJson  Json
  createdAt DateTime @default(now())
  thread    ForumThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author    User        @relation(fields: [authorId], references: [id])
  parent    ForumPost?  @relation("ForumReply", fields: [parentId], references: [id])
  replies   ForumPost[] @relation("ForumReply")
  @@index([threadId, createdAt])
}

model Group {
  id          String  @id @default(cuid())
  slug        String  @unique // job-alerts, social-network
  name        String
  description String? @db.Text
  isOfficial  Boolean @default(false)
  createdById String
  memberships GroupMember[]
  posts       GroupPost[]
}

model GroupMember {
  groupId String
  userId  String
  role    String @default("MEMBER") // group role, not User.role
  group   Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user    User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([groupId, userId])
}

model GroupPost {
  id        String   @id @default(cuid())
  groupId   String
  authorId  String
  bodyJson  Json
  pollJson  Json?    // { question, options: string[] } — votes in PollVote
  createdAt DateTime @default(now())
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])
  votes     PollVote[]
}

model PollVote {
  id         String   @id @default(cuid())
  groupPostId String
  userId     String
  optionIdx  Int
  createdAt  DateTime @default(now())
  groupPost  GroupPost @relation(fields: [groupPostId], references: [id], onDelete: Cascade)
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([groupPostId, userId])
}

model FeedPost {
  id        String   @id @default(cuid())
  authorId  String
  bodyJson  Json
  createdAt DateTime @default(now())
  author    User     @relation(fields: [authorId], references: [id])
  @@index([createdAt])
}

model Reaction {
  id         String   @id @default(cuid())
  userId     String
  targetType String   // FORUM_POST FEED_POST GROUP_POST
  targetId   String
  emoji      String   @db.VarChar(16)
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, targetType, targetId, emoji])
  @@index([targetType, targetId])
}

model Report {
  id         String       @id @default(cuid())
  reporterId String
  targetType String
  targetId   String
  reason     String       @db.VarChar(191)
  status     ReportStatus @default(OPEN)
  createdAt  DateTime     @default(now())
  reporter   User         @relation("reporter", fields: [reporterId], references: [id])
  @@index([status, createdAt])
}
```

### Bookings, services, events

```prisma
model ConsultationService {
  id              String           @id @default(cuid())
  slug            String           @unique
  title           String
  descriptionJson Json
  durationMinutes Int
  pricePaise      Int              // seed: Career 249900, Psychology 299900, Admission 499900
  mode            ConsultationMode @default(ONLINE)
  isActive        Boolean          @default(true)
  expertId        String?          // null = assign any available EXPERT at booking time
  bookings        Booking[]
}

model ExpertAvailability {
  id        String   @id @default(cuid())
  expertId  String
  weekday   Int      // 0-6 Asia/Kolkata
  startMin  Int
  endMin    Int
  timezone  String   @default("Asia/Kolkata")
  expert    User     @relation(fields: [expertId], references: [id], onDelete: Cascade)
  @@index([expertId, weekday])
}

model Booking {
  id              String        @id @default(cuid())
  serviceId       String
  expertId        String
  customerId      String
  startsAt        DateTime
  endsAt          DateTime
  status          BookingStatus @default(PENDING_PAYMENT)
  meetingUrl      String?       @db.VarChar(512)
  notes           String?       @db.Text
  razorpayOrderId String?
  createdAt       DateTime      @default(now())
  service         ConsultationService @relation(fields: [serviceId], references: [id])
  expert          User          @relation("expert", fields: [expertId], references: [id])
  customer        User          @relation("customer", fields: [customerId], references: [id])
  @@unique([expertId, startsAt])
  @@index([customerId, startsAt])
}

model Event {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  descriptionJson Json
  startsAt        DateTime
  endsAt          DateTime?
  location        String?
  isOnline        Boolean  @default(true)
  capacity        Int?
  pricePaise      Int      @default(0)
  published       Boolean  @default(false)
  registrations   EventRegistration[]
}

model EventRegistration {
  id        String   @id @default(cuid())
  eventId   String
  userId    String
  status    String   @default("REGISTERED")
  createdAt DateTime @default(now())
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([eventId, userId])
}
```

### Commerce, wallet, subscriptions

```prisma
model Product {
  id              String      @id @default(cuid())
  slug            String      @unique
  name            String
  descriptionJson Json
  type            ProductType
  pricePaise      Int
  currency        String      @default("INR")
  sku             String      @unique
  stock           Int?        // null = digital / unlimited; decrement in tx
  hsnSac          String?     @db.VarChar(16)
  weightGrams     Int?
  isActive        Boolean     @default(true)
  categoryId      String
  category        ProductCategory @relation(fields: [categoryId], references: [id])
  orderItems      OrderItem[]
  cartItems       CartItem[]
  @@index([categoryId, isActive])
}

model ProductCategory {
  id       String    @id @default(cuid())
  slug     String    @unique
  name     String
  products Product[]
}

model Cart {
  id        String     @id @default(cuid())
  userId    String     @unique
  updatedAt DateTime   @updatedAt
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     CartItem[]
}

model CartItem {
  id        String  @id @default(cuid())
  cartId    String
  productId String
  qty       Int
  cart      Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])
  @@unique([cartId, productId])
}

model Address {
  id         String @id @default(cuid())
  userId     String
  name       String
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String
  country    String @default("IN")
  phone      String?
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders     Order[]
}

model Order {
  id                String      @id @default(cuid())
  userId            String
  status            OrderStatus @default(PENDING_PAYMENT)
  subtotalPaise     Int
  taxPaise          Int         @default(0)
  shippingPaise     Int         @default(0) // metro 7900 / rest 12900 paise
  totalPaise        Int
  currency          String      @default("INR")
  invoiceNumber     String?     @unique
  buyerGstin        String?
  shippingAddressId String?
  razorpayOrderId   String?     @unique
  razorpayPaymentId String?
  expiresAt         DateTime?   // 15 min; aligned with Razorpay order expiry
  createdAt         DateTime    @default(now())
  user              User        @relation(fields: [userId], references: [id])
  shippingAddress   Address?    @relation(fields: [shippingAddressId], references: [id])
  items             OrderItem[]
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  productId String
  qty       Int
  unitPaise Int
  taxPaise  Int     @default(0)
  hsnSac    String?
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])
}

model PaymentEvent {
  id              String          @id @default(cuid())
  provider        PaymentProvider
  providerEventId String          // Razorpay/Stripe event id
  kind            PaymentKind
  orderId         String?
  bookingId       String?
  payload         Json
  processedAt     DateTime        @default(now())
  @@unique([provider, providerEventId])
  @@index([kind, processedAt])
}

model ShippingRate {
  id    String @id @default(cuid())
  slug  String @unique // metro | rest_of_india
  name  String
  paise Int
}

model WalletAccount {
  id           String @id @default(cuid())
  userId       String @unique
  balancePaise Int    @default(0)
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  ledger       WalletLedger[]
}

model WalletLedger {
  id         String   @id @default(cuid())
  accountId  String
  deltaPaise Int
  reason     String
  createdAt  DateTime @default(now())
  account    WalletAccount @relation(fields: [accountId], references: [id])
}

model Plan {
  id             String @id @default(cuid())
  slug           String @unique // webinars-guidance
  name           String
  description    String @db.Text
  pricePaise     Int    // v1: 1000 = ₹10
  interval       String @default("once") // v1 one-time pack, not Razorpay Subscriptions
  durationMonths Int    @default(3)
  entitlements   Json   // { webinars: true } — NOT resources
  subscriptions  Subscription[]
}

model Subscription {
  id               String             @id @default(cuid())
  userId           String
  planId           String
  status           SubscriptionStatus
  currentPeriodEnd DateTime
  razorpayOrderId  String?            // one-time order id, not subscription id
  createdAt        DateTime           @default(now())
  user             User               @relation(fields: [userId], references: [id])
  plan             Plan               @relation(fields: [planId], references: [id])
  @@index([userId, status])
}
```

### Files, resources, flags, audit, consents

```prisma
model FileObject {
  id             String        @id @default(cuid())
  bucket         String
  objectKey      String        @unique // e.g. public/products/{id}/a.jpg or private/resources/{id}/x.pdf
  mimeType       String
  byteSize       Int
  checksumSha256 String
  acl            FileAcl       @default(PRIVATE)
  ownerType      FileOwnerType
  ownerId        String
  uploadedById   String
  uploadedBy     User          @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime      @default(now())
  resourceAsFile Resource?     @relation("ResourceFile")
  @@index([ownerType, ownerId])
}

model Resource {
  id           String             @id @default(cuid())
  slug         String             @unique
  title        String
  kind         ResourceKind
  status       ResourceStatus     @default(IN_REVIEW)
  visibility   ResourceVisibility @default(EDUCATOR_ONLY)
  board        Board?
  classLevel   String?
  subject      String?
  fileId       String             @unique
  file         FileObject         @relation("ResourceFile", fields: [fileId], references: [id])
  uploadedById String
  uploadedBy   User               @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime           @default(now())
  downloads    ResourceDownload[]
  @@index([kind, board, classLevel, subject])
  @@index([status, visibility])
}

model ResourceDownload {
  id         String   @id @default(cuid())
  resourceId String
  userId     String
  createdAt  DateTime @default(now())
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([resourceId, createdAt])
}

model CronLease {
  job         CronJobName @id
  lockedUntil DateTime
  lastRunAt   DateTime?
}

model FeatureFlag {
  key       String  @id
  enabled   Boolean @default(false)
  payload   Json?
}

model AuditEvent {
  id        String   @id @default(cuid())
  actorId   String?
  actor     User?    @relation(fields: [actorId], references: [id])
  action    String
  entity    String
  entityId  String
  meta      Json?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
}

model Consent {
  id        String      @id @default(cuid())
  userId    String
  type      ConsentType
  version   String
  grantedAt DateTime    @default(now())
  ip        String?
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, type])
}

model ContactMessage {
  id        String   @id @default(cuid())
  kind      String   // contact career blog_pitch expert_volunteer
  name      String
  email     String
  payload   Json
  createdAt DateTime @default(now())
}
```

**File images for products/posts:** `FileObject` rows with `ownerType=PRODUCT|POST|USER` and `acl=PUBLIC`. Query `where: { ownerType, ownerId }`. Do **not** add `Product.images FileObject[]` — that relation will not validate against the polymorphic columns.

**Migration strategy:** Prisma migrate from empty DB. No Wix schema to convert. PR 03 commits this full schema so later PRs do not invent tables. Seed scripts populate CMS pages, 68 posts, 2 products, 3 services, 2 groups, 1 plan (`webinars-guidance`, ₹10 / 3 months / `entitlements.webinars`), forum categories.

---

## Auth model

### Stack

- **Auth.js / NextAuth v5** (`next-auth@5`, `import NextAuth from "next-auth"`)
- Adapter: `@auth/prisma-adapter` for **User + Account + VerificationToken** (and unused `Session` table for adapter compatibility)
- Session: **JWT** (`strategy: "jwt"`). Credentials **does not** create `Session` rows; database strategy + Credentials leaves `auth()` null after email/password login. JWT + `jwt`/`session` callbacks is the supported combination. `proxy.ts` is Node in Next 16.3, so Prisma is still usable in Route Handlers and the adapter — just not for the session cookie.
- Providers (`allowDangerousEmailAccountLinking: false` on all OAuth):
  1. `Credentials` — email + password (`@node-rs/argon2`); require `emailVerified` and `status=ACTIVE` (or `PENDING_PROFILE` only to reach `/complete-profile`)
  2. **Google** — required
  3. **Apple** — required (iOS-friendly)
  4. **Facebook**
  5. **LinkedIn** — educators
- **Do not** add GitHub as a teacher login. Microsoft/Azure AD is out of v1.
- Login UI: email/password form + “Continue with Google / Apple / Facebook / LinkedIn”.
- **Every OAuth path** uses the wrapped `createUser` → `PENDING_PROFILE` and the same DOB / age gate as credentials. No provider skips the gate.
- **Do not** use the `createSession` Credentials workaround unless JWT is later abandoned.

### Username + Google createUser

Wrap the Prisma adapter so `username` is generated **before** INSERT (slug of name/email + short suffix). `events.createUser` is too late.

```ts
const base = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...base,
  createUser: async (data) => {
    const username = await generateUniqueUsername(data.name, data.email);
    return base.createUser!({
      ...data,
      username,
      status: "PENDING_PROFILE", // OAuth never collected DOB
      role: "EDUCATOR",
    } as any);
  },
};
```

Credentials register is a Server Action (not `createUser` from OAuth): insert with `username`, `dateOfBirth`, `status=PENDING_VERIFICATION`, then send verify email.

### Account linking (same verified email)

`allowDangerousEmailAccountLinking: false` stays. Flows:

1. User has credentials (verified) and later clicks any OAuth: `signIn` callback sees existing `User` with same email → redirect to `/login?error=LinkRequired`. After password login, `/account/settings` → `linkAccount`.
2. User has OAuth and later sets a password: `linkCredentials` hashes and stores `passwordHash` on the same `User`.
3. Never auto-merge unverified emails. Same flow for Google, Apple, Facebook, LinkedIn.

### Wiring sketch

```ts
// src/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Facebook from "next-auth/providers/facebook";
import LinkedIn from "next-auth/providers/linkedin";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter, // wrapped PrismaAdapter above
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  cookies: {
    sessionToken: {
      name: process.env.AUTH_URL?.startsWith("https://www.eduvoq.com")
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: { domain: process.env.AUTH_COOKIE_DOMAIN || undefined, sameSite: "lax", path: "/" },
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-email",
    newUser: "/complete-profile",
  },
  providers: [
    Google({ allowDangerousEmailAccountLinking: false }),
    Apple({ allowDangerousEmailAccountLinking: false }),
    Facebook({ allowDangerousEmailAccountLinking: false }),
    LinkedIn({ allowDangerousEmailAccountLinking: false }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        /* find user, argon2.verify; reject BANNED/SUSPENDED;
           allow ACTIVE or PENDING_PROFILE; reject PENDING_VERIFICATION */
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.status = (user as any).status;
        token.tokenVersion = (user as any).tokenVersion ?? 0;
      }
      if (trigger === "update") {
        const db = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (db) {
          token.role = db.role;
          token.username = db.username;
          token.status = db.status;
          token.tokenVersion = db.tokenVersion;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.username = (token.username as string) ?? null;
      session.user.status = token.status as UserStatus;
      (session.user as { tokenVersion?: number }).tokenVersion = (token.tokenVersion as number) ?? 0;
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider && account.provider !== "credentials") {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { accounts: true },
        });
        if (existing && !existing.accounts.some((a) => a.provider === account.provider)) {
          return "/login?error=LinkRequired";
        }
      }
      return true;
    },
  },
});
```

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

```ts
// src/proxy.ts  (Next.js 16 successor to middleware.ts)
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED = [
  /^\/account/,
  /^\/admin/,
  /^\/resources/,
  /^\/notifications/,
  /^\/book(\/|$)/,
  /^\/community/,
  /^\/groups/,
  /^\/cart/,
  /^\/checkout/,
  /^\/complete-profile/,
];
const ADMIN = [/^\/admin/];

const AUTH_PAGES = [/^\/login/, /^\/register/, /^\/forgot-password/, /^\/verify-email/, /^\/api\/auth/];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // In-memory IP token bucket — matcher MUST include these paths or this never runs
  // (v1 single replica; Redis if multi-replica)
  rateLimit(req); // /login /register /api/auth /forgot-password

  if (PROTECTED.some((r) => r.test(pathname)) && !session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  const skipPending =
    AUTH_PAGES.some((r) => r.test(pathname)) || pathname.startsWith("/complete-profile");
  if (session?.user.status === "PENDING_PROFILE" && !skipPending) {
    return NextResponse.redirect(new URL("/complete-profile", req.nextUrl));
  }
  if (ADMIN.some((r) => r.test(pathname)) && session?.user.role !== "ADMIN" && session?.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/api/auth/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/resources/:path*",
    "/notifications/:path*",
    "/book/:path*",
    "/community/:path*",
    "/groups/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/complete-profile",
  ],
};
```

```ts
// src/server/rbac.ts — JWT is a hint; MySQL is source of truth for status/revocation
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.status === "BANNED" || user.status === "SUSPENDED" || user.status === "PENDING_VERIFICATION") {
    throw new Error("FORBIDDEN");
  }
  const jwtVersion = (session.user as { tokenVersion?: number }).tokenVersion ?? 0;
  if (jwtVersion !== user.tokenVersion) throw new Error("UNAUTHORIZED"); // password reset / ban
  return user; // PENDING_PROFILE allowed only for completeProfile
}

export async function requireRole(...roles: Role[]) {
  const user = await requireSession();
  if (user.status !== "ACTIVE" && !(user.status === "PENDING_PROFILE" && roles.length === 0)) {
    /* mutations other than completeProfile require ACTIVE */
  }
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function revokeSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
```

`banUser` and `resetPassword` call `revokeSessions`. JWT `maxAge` 14d is UX, not a ban delay.

`/forum` listing stays public; posting is `requireSession()` on actions. `/consult` and `/store` stay public shells with login CTAs.

**Defense in depth:** every Server Action and admin RSC calls `requireSession()` / `requireRole(...)` which **re-reads MySQL**. Proxy is a UX gate, not the only check. JWT claims are stale until `update`; they are never trusted for ban/status.

### RBAC

| Role | Who | Capabilities |
| --- | --- | --- |
| **ADMIN** | Operators | All; flags; refunds; user ban; **grant EXPERT** |
| **STAFF** | Content/ops | CMS, moderation, bookings, orders (no flag/keys) |
| **EXPERT** | Consultants | Availability, own bookings, resource upload. **Not self-serve** — admin grants after email to `hello@eduvoq.com` |
| **EDUCATOR** | Default public signup | Profile, feed, forum, groups, submit blogs, book as customer, **download EDUCATOR_ONLY library** once `ACTIVE` |
| **PARENT** | Adults registering children | Own account + manage child Student accounts; book consultations. Justified by news meta (parents welcome for consultations) and About Us (homework / college-application advice) |
| **STUDENT** | K-12 learner | Restricted profile; **cannot self-register**; parent creates the row. Cannot post in public feed; cannot follow arbitrary adults. **No messaging/DM feature exists** |

Default signup role: **EDUCATOR**. “I am a parent” → `PARENT`. `student_self_register=false` is a **Key Decision**, not an open question.

### Email verification, password reset, pending profile

- Credentials: `VerificationToken` + `/verify-email?token=` → `ACTIVE` only if DOB already stored and age ≥ 18
- Unverified users cannot post, book, or checkout
- Reset: 1-hour expiry, 5 / hour / email
- Google: `emailVerified` set by provider, but `status=PENDING_PROFILE` until `/complete-profile` captures DOB + TOS. If DOB implies age < 18, refuse activation and instruct a parent to register.

---

## Route map (clean URLs)

Wix `/chalknpencil` prefix is dropped. Permanent redirects from old paths (and from `eduvoq.wixsite.com` after DNS cutover).

| New route | Auth | Source |
| --- | --- | --- |
| `/` | public | Home |
| `/about` | public | `/about-us` |
| `/contact` | public | `/contact` |
| `/careers` | public | `/careers` |
| `/news` | public | `/news` |
| `/privacy` | public | `/privacy-policy` |
| `/terms` | public | `/tnc` |
| `/sitemap` | public | `/site-map` |
| `/pricing` | public | `/plans-pricing` |
| `/thank-you` | public | `/thank-you-page` |
| `/services` | public | index of school-ops |
| `/services/[slug]` | public | school-ops + career-counselling + marketing |
| `/consult` | public | `/expert-consultation` |
| `/consult/[slug]` | public | `/service-page/...` |
| `/book/[slug]` | member | `/booking-calendar` + `/booking-form` |
| `/blog` | public | `/blog` |
| `/blog/categories/[slug]` | public | e-magazine |
| `/blog/tags/[slug]` | public | tags |
| `/blog/[slug]` | public | `/post/{slug}` |
| `/blog/submit` | public/member | `/submit-your-blog` |
| `/members` | public | `/members` |
| `/members/[username]` | public | `/profile/{u}/profile` |
| `/community` | member | `/social-network` |
| `/groups` | member | |
| `/groups/[slug]` | member | `/group/job-alerts`, `/group/social-network` |
| `/forum` | public list / member post | rebuilt `/forum` |
| `/forum/[category]/[thread]` | public | |
| `/resources` | member (proxy) | Resource Corner hub |
| `/resources/learning-material` | member; files `EDUCATOR_ONLY` | `/learning-material` |
| `/resources/class-notes` | member; files `EDUCATOR_ONLY` | `/class-notes` |
| `/sample-papers` | **public teaser** | Wix `/sample-papers` (title Lesson Plans). Lists SAMPLE_PAPER + LESSON_PLAN metadata; download buttons hit `/api/files/[id]` (login + entitlement). |
| `/resources/sample-papers` | member | Same data, logged-in view |
| `/complete-profile` | session `PENDING_PROFILE` | Google DOB + TOS |
| `/store` | public | `/category/all-products` |
| `/store/products/[slug]` | public | `/product-page/...` |
| `/cart` | member | `/cart-page` |
| `/checkout` | member | `/checkout` |
| `/events` | public | `/event-list` |
| `/events/[slug]` | public | `/event-details/...` |
| `/login` `/register` `/forgot-password` | public | Wix login bar |
| `/account` | member | `/account/my-account` |
| `/account/addresses` `/orders` `/bookings` `/posts` `/subscriptions` `/wallet` `/notifications` `/settings` | member | matching Wix |
| `/admin/*` | staff | new |
| `/rss.xml` `/sitemap.xml` `/robots.txt` | public | `/blog-feed.xml` |

Redirect examples in `next.config.ts`: `/copy-of-cultural-activities` → `/services/marketing`, `/about-us` → `/about`, `/post/:slug` → `/blog/:slug`, `/plans-pricing` → `/pricing`, `/my-wallet` → `/account/wallet` (and the other `/my-*` root aliases), `/account/my-wallet` → `/account/wallet`. Wix `/sample-papers` stays `/sample-papers` (public teaser). `/news` is `PostKind.NEWS` (same `Post` table as blog, different list). About page publishes Pragya Sharma’s migrated founder copy by default.

---

## Product feature design (first-class domains)

### Public site & CMS pages

`CmsPage` rows for About, Privacy, Terms, Careers, each `/services/*`. Home is a composed RSC (hero from copy, latest 3 posts, consult CTAs, community CTAs) — not a giant CMS blob. Page editing lives in **PR 16** `/admin/pages` (TipTap), not a second admin in PR 06.

Contact form stores `ContactMessage` and emails `CONTACT_TO` (default `hello@eduvoq.com`). Careers and submit-blog are variants of the same pipeline.

### Community & rebuilt forum

Forum v1 (replaces discontinued Wix Forum):

- Categories seeded from homepage promise: Curriculum Development, Classroom Management, Pedagogical Strategies, Assessments & Boards (CBSE/ICSE/IB/KV), Career & Jobs, General.
- Thread + flat replies (`ForumPost.parentId`).
- Moderation: `Report` → staff queue; spam hide; lock/pin.
- Groups: seed **Job Alerts** and **Social Network**; posts + optional `pollJson`; votes in `PollVote` (`@@unique([groupPostId, userId])`). No UUID discussion migration.

Social feed (`/community`): educator-only by default; media via FileObject. Students do not appear in public members directory unless a parent opts them into a **first-name + grade only** card. **No DMs / inbox.**

### Consultations

- Slot generation: `ExpertAvailability` × duration, minus existing `Booking` overlaps, in `Asia/Kolkata`.
- v1 mode: **ONLINE** default (`Booking.meetingUrl`). Archive UI said “Customer's Place” — keep as an optional `ConsultationMode` for Admission Consulting only; do not build field-ops.
- **Concurrency:** `createBooking` runs in a Prisma interactive transaction: pick expert → insert booking. `@@unique([expertId, startsAt])` makes a double-book throw; retry once with the next expert. If `ConsultationService.expertId` is set, use that expert; if null, pick an `EXPERT` with matching weekday window and the fewest confirmed bookings that calendar day.
- **Seed prices (staff-editable, owner 2026-09-08):**

| Service | Duration | Price | paise |
| --- | --- | --- | --- |
| Career Options and Counselling | 1h | ₹2,499 | 249900 |
| Psychology Consultation | 1h | ₹2,999 | 299900 |
| Admission Consulting Advisory | 2h | ₹4,999 | 499900 |

  Mid-experienced educator consulting (India 2026: career sessions typically ₹1,500–5,000; independent ~₹4,000) — not luxury study-abroad.

- Payment: always `pricePaise > 0` for these three. Create a **15-minute** gateway order: **Razorpay** if billing country is IN (default), **Stripe** if the user picks “Pay with card (international)”. Prefer Stripe India **INR** so catalog stays paise. Webhook `PaymentEvent` unique on `(provider, providerEventId)` → `CONFIRMED`.
- Emails: booked, reminder T-24h and T-1h via cron (lease-locked).

### Learning resources (entitlement matrix)

Taxonomy: `kind` × `board` × `classLevel` × `subject`.

| Visibility | Who may download |
| --- | --- |
| `PUBLIC` | Anyone (rare teaser PDF) |
| `EDUCATOR_ONLY` | **v1 default.** `ACTIVE` users with role `EDUCATOR`, `EXPERT`, `STAFF`, or `ADMIN` |
| `SUBSCRIBER` | Unused in v1. Reserved if a later pack gates extra files |

Paid plan **Webinars and Guidance** unlocks webinars only (`entitlements.webinars`). It does **not** unlock Resource Corner.

`/sample-papers` (public, **not** behind `proxy.ts`): list titles, board, class. Download of a non-PUBLIC file → login, then `requestDownload` if entitled. `/resources/*` remains member-only for the rest of Resource Corner.

Uploads: educators → `Resource.status=IN_REVIEW`; staff/admin may publish. Downloads: insert `ResourceDownload`, then `GET /api/files/[id]` (prod: stream from disk; dev: 60s S3 presign). Never a permanent public URL for `PRIVATE` files.

### Commerce catalog (real, not placeholders)

v1 ships **only** the two migrated SKUs. Extra stationery/digital SKUs are out until the owner prices them.

| SKU | Name | Type | Price | Notes |
| --- | --- | --- | --- | --- |
| EV-DIARY-001 | Student's Diary | PHYSICAL | ₹188 | migrated copy |
| EV-TTREG-001 | Time-table Arrangement Register | PHYSICAL | ₹300 | migrated copy |

- **Cart:** DB `Cart`/`CartItem` per user. **Member-only**; no guest cart, no signed-cookie cart.
- **Checkout sequence:** (1) `placeOrder` in a transaction: lock product rows, reject if `stock != null && stock < qty`, compute `shippingPaise` from pincode/city band, create `Order` `PENDING_PAYMENT` with `expiresAt = now+15m`, decrement stock, snapshot GST fields (`taxPaise=0` until GSTIN known, `hsnSac`, `invoiceNumber` assigned on PAID). (2) Create gateway order (Razorpay if IN, else/on-request Stripe; 15 min expiry). (3) Client Checkout. (4) `POST /api/webhooks/razorpay` or `/api/webhooks/stripe` verifies signature, inserts `PaymentEvent` `@@unique([provider, providerEventId])` (duplicate → no-op), marks `PAID`. (5) Cron releases stock for expired `PENDING_PAYMENT`.
- **PHYSICAL shipping (on):** India-only addresses. **Self-ship** from the operator (Delhi-centric). No 3PL, **no COD**. Two staff-editable `ShippingRate` rows:
  - `metro` — NCR, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Pune — **₹79** (7900 paise)
  - `rest_of_india` — **₹129** (12900 paise)
  After payment, status `FULFILLING`; admin marks `SHIPPED`/`DELIVERED`. Flag `commerce_physical` default **true** (emergency disable only).
- GST: `taxPaise` 0 until GSTIN is known (ops note, not a product question); `buyerGstin` optional; `invoiceNumber` `EV-YYYY-#####` on payment.

### Subscriptions & wallet

- Plan seed: `webinars-guidance`, **₹10 one-time for 3 months** (`interval=once`, `durationMonths=3`, `pricePaise=1000`). Implemented as a **one-time Razorpay or Stripe order**, not Razorpay Subscriptions / Stripe Billing. Entitlements: `{ webinars: true }` only.
- Wallet: schema present; **`wallet_spend` default off**. `/account/wallet` is display-only.

### Events

Admin-created events. Registration table. If `pricePaise>0`, Razorpay. Do not seed science-fair/field-trip with template lorem.

### Admin

`/admin` dashboard: users, CMS pages, posts queue, forum reports, bookings calendar, orders, resources, plans, flags, audit. Simple counts — not a data warehouse.

### AI module (optional, SpaceXAI / xAI)

**Provider:** xAI API. Env: `XAI_API_KEY`. Base URL: `https://api.x.ai/v1`. Default model: `grok-4.5`. SDK: Vercel AI SDK `@ai-sdk/xai` (OpenAI-compatible).

**Does not block v1 launch.** Flag `ai_assistants`.

| Feature | Phase | Who | Why it fits EduVoq |
| --- | --- | --- | --- |
| Lesson-plan assistant | **v1 optional** | Educator | `/sample-papers` is titled Lesson Plans; blog “Mastering the Art of Lesson Planning” |
| Blog draft helper | **v1 optional** | Submit-your-blog | Directly supports `/blog/submit` |
| Consultation summarization | later | Expert | After bookings exist |
| Resource Q&A over PDFs | later | Entitled users | Needs embeddings/files pipeline |
| Moderation assist | later | Staff | Forum/feed |

Never send student PII or child account content to the model. System prompts forbid generating board-exam “leaks”. Log prompts/completions with user id hashed, 30-day retention.

---

## Content migration plan

Honest scope: **published public HTML only**. No Wix Members CMS, no live store inventory beyond two SKUs, no booking history, no forum threads (product dead), no 404 profiles.

### What can be migrated

| Asset | Source | Method |
| --- | --- | --- |
| 68 blog posts | `rendered/chalknpencil__post__*.html` + `blog-posts-sitemap.xml` | Extract `wixui-rich-text` / og title+image; convert to TipTap JSON; download covers from `static.wixstatic.com` into MinIO |
| Tags / e-magazine | `urls-content.txt`, `blog-categories-sitemap.xml` | Seed Tag/Category |
| About, services, careers, privacy, terms | wget/rendered HTML | Manual editorial pass into `CmsPage` — Wix markup is nested spans; script extracts text, humans fix poems vs prose |
| Two products | product-page HTML | Seed Product + images |
| Three services | service-page HTML | Seed ConsultationService (120 min ₹4,999; 60 min ₹2,499 career; 60 min ₹2,999 psychology) |
| Nav/footer IA | homepage | Hardcoded nav config |
| RSS identity | `blog-feed.xml` | New `/rss.xml` |

### What cannot be migrated

- Learning Material / Class Notes bodies
- Account data, wallets, orders, bookings
- Forum posts
- Member profiles (404)
- Placeholder products
- Portfolio projects
- Event descriptions (boilerplate)
- Live Wix widget state (pricing JS, groups composer)

### Pipeline (`scripts/migrate-wix/`)

1. `extract-posts.ts` — cheerio over rendered post HTML, write `migration/posts.json`
2. `extract-pages.ts` — service/about/legal text
3. `fetch-media.ts` — download referenced `static.wixstatic.com/media/*` used by posts/products (not the entire 1.1 GiB video dump unless editorial wants the two homepage videos)
4. `prisma/seed.ts` — upsert from JSON
5. Editorial checklist: 68 titles, broken images, author attribution (many Wix posts may be org-authored — assign `eduvoq-editorial` user)

Redirect map committed as `redirects.json` for Caddy + Next.

---

## Caddy + deploy

Two environments. **Do not** run a second Compose stack on the production droplet.

| | Local / CI | Production (owner 2026-09-08) |
| --- | --- | --- |
| Host | Developer laptop | DigitalOcean droplet **neojn**, `blr1` (Bangalore), IPv4 `68.183.85.203`, private `10.47.0.6` |
| OS | macOS / Linux | Ubuntu 25.10 (non-LTS; MOTD offers 26.04.1 — ops risk, do not depend on 25.10-only packages) |
| App | Compose `app:3000` | systemd `eduvoq.service`, `127.0.0.1:3110`, User=`www-data`, `WorkingDirectory=/var/www/eduvoq/.next/standalone`, `ExecStart=/usr/bin/node server.js`, `NODE_OPTIONS=--max-old-space-size=384` |
| Reverse proxy | Compose Caddy :80 | **Host Caddy already running** (`/etc/caddy/Caddyfile` imports `/etc/caddy/sites/*.caddy`) |
| TLS | off / local_certs | Host Caddy (existing) |
| DB | Compose MySQL `eduvoq` | Host MySQL `127.0.0.1:3306` — **create `eduvoq_db`**, user `eduvoq` (least privilege, not root). Do **not** share tables with chessyi, schoolyi_db, etc. |
| Files | MinIO in Compose (`FILE_DRIVER=s3`) | Local disk `/var/www/eduvoq/storage` (`FILE_DRIVER=local`), www-data, not world-readable |
| Canonical URL | `http://localhost` | `https://www.eduvoq.com` (`AUTH_URL`). Cookie domain `.eduvoq.com` |
| DNS | — | A for `@` and `www` → `68.183.85.203` |

SSH (Termix / `~/.ssh/config`): `Host neojn` / `do-neojn`, `HostName 68.183.85.203`, `User root`, `IdentityFile ~/.ssh/id_ed25519_m5macpro`. **Never commit private keys, Termix ENCRYPTION_KEY, or MySQL passwords.**

Host facts (verified `ssh neojn` 2026-09-08): 4 vCPU, 7.8 GiB RAM (tight: ~2 GiB free, 4.2 GiB swap), 48G disk ~54% used. Occupied Next ports include 3020–3100 (neojn.com, treydnet, niyotek, presel, chessyi, secondri, schoolyi, webcomyi, lynkin, foodyi, niharika-gyan). **EduVoq = `127.0.0.1:3110` (unused).** Docker is present (`openwa-api` on 2785) — **do not add a MinIO container** on this RAM-tight box. UFW already 22/80/443; no extra public ports.

Rate limits live in `proxy.ts`. Cron: `Authorization: Bearer $CRON_SECRET` (host crontab or systemd timer to `http://127.0.0.1:3110/api/cron`).

### Local Caddyfile (`caddy/Caddyfile.local`)

```caddy
{
  local_certs
  auto_https off
}

:80 {
  encode gzip
  handle {
    reverse_proxy app:3000
  }
}
```

### Production Caddy site (`/etc/caddy/sites/eduvoq.caddy`)

neojn-deploy v3 style. Apex **301 → www** (same pattern as schoolyi.com → www.schoolyi.com).

```caddy
www.eduvoq.com {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3110
}

eduvoq.com {
  redir https://www.eduvoq.com{uri}
}
```

Do **not** import a dedicated Caddy container Caddyfile on this host. Do not collide with existing `/etc/caddy/sites/*.caddy`.

### systemd (`/etc/systemd/system/eduvoq.service`)

Copy `schoolyi.service` pattern: `User=www-data`, `EnvironmentFile=-/var/www/eduvoq/.env`, `WorkingDirectory=/var/www/eduvoq/.next/standalone`, `ExecStart=/usr/bin/node server.js`, `PORT=3110` / bind `127.0.0.1`. `NODE_OPTIONS=--max-old-space-size=384`. App dir `/var/www/eduvoq`. Next `output: "standalone"`. Node from **NodeSource LTS**, not Ubuntu 25.10-only packages.

This droplet already runs **11 Next apps on 8 GB**. If EduVoq RSS grows, move it to its own droplet later. **Do not block launch on a new VPS.**

### docker-compose (dev)

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: eduvoq
      MYSQL_USER: eduvoq
      MYSQL_PASSWORD: eduvoq
      MYSQL_ROOT_PASSWORD: root
    ports: ["3306:3306"]
    volumes: [mysql_data:/var/lib/mysql]
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci"]
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1"]
      interval: 5s
      timeout: 5s
      retries: 20

  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: miniopass
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio_data:/data]

  mailpit:
    image: axllent/mailpit:latest
    ports: ["8025:8025", "1025:1025"]

  app:
    build: .
    environment:
      DATABASE_URL: mysql://eduvoq:eduvoq@mysql:3306/eduvoq
      AUTH_SECRET: devsecret
      AUTH_URL: http://localhost
      S3_ENDPOINT: http://minio:9000
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
    depends_on:
      mysql: { condition: service_healthy }
    ports: ["3000:3000"]

  caddy:
    image: caddy:2
    volumes: ["./caddy/Caddyfile.local:/etc/caddy/Caddyfile"]
    ports: ["80:80"]
    depends_on: [app]

volumes:
  mysql_data:
  minio_data:
```

Compose is **dev only**. Production uses systemd + host MySQL + host Caddy as above.

### Env vars

```
DATABASE_URL=                 # prod: mysql://eduvoq:***@127.0.0.1:3306/eduvoq_db
AUTH_SECRET=
AUTH_URL=                     # prod: https://www.eduvoq.com
AUTH_COOKIE_DOMAIN=.eduvoq.com
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_APPLE_ID=
AUTH_APPLE_SECRET=
AUTH_FACEBOOK_ID=
AUTH_FACEBOOK_SECRET=
AUTH_LINKEDIN_ID=
AUTH_LINKEDIN_SECRET=
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS=
EMAIL_FROM=hello@eduvoq.com
CONTACT_TO=hello@eduvoq.com
FILE_DRIVER=                  # local (prod) | s3 (Compose MinIO)
FILE_LOCAL_ROOT=/var/www/eduvoq/storage
S3_ENDPOINT= S3_REGION=us-east-1 S3_BUCKET=eduvoq S3_ACCESS_KEY= S3_SECRET_KEY= S3_FORCE_PATH_STYLE=true
RAZORPAY_KEY_ID= RAZORPAY_KEY_SECRET= RAZORPAY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
CRON_SECRET=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
XAI_API_KEY=                  # optional
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-4.5
SENTRY_DSN=                   # optional
NEXT_PUBLIC_APP_URL=          # https://www.eduvoq.com
PORT=3110
HOSTNAME=127.0.0.1
NODE_OPTIONS=--max-old-space-size=384
```

Merchant IDs / OAuth client secrets stay in `.env` on the server (`/var/www/eduvoq/.env`, mode 0640, www-data). They are not product questions.

### Cron

`GET /api/cron` with `Authorization: Bearer $CRON_SECRET` every 5 minutes. Overlap lock: `UPDATE CronLease SET lockedUntil = now()+4m WHERE job=? AND lockedUntil < now()`; skip if 0 rows. Jobs: booking reminders, pack expiry, unpaid order timeout (15 min, aligned with Razorpay order expiry), hourly digest. Never rely on Caddy `remote_ip`.

---

## Standard library choices (justified)

| Concern | Choice | Why |
| --- | --- | --- |
| UI | Tailwind CSS v4 + **shadcn/ui** (Radix) | Matches Next App Router; copy-paste components; no vendor lock-in of MUI |
| Forms | **React Hook Form** + **Zod** + `@hookform/resolvers` | Server/client shared schemas |
| Client cache | **TanStack Query** | Cart, slots, notifications inbox; RSC for first paint |
| Rich text | **TipTap** (ProseMirror) | JSON storage, sanitizable; better than raw Markdown for educator posts |
| Sanitize HTML | `sanitize-html` on any HTML import; TipTap JSON for app-native | XSS |
| Email | **React Email** templates + **Nodemailer** SMTP; Mailpit locally; production SES or Postmark | Self-hosted friendly; Resend is fine if they prefer SaaS — SMTP keeps Caddy/VPS portable |
| Uploads | **`FILE_DRIVER=local` in prod** (`/var/www/eduvoq/storage`); MinIO in Compose only | RAM-tight neojn; entitlement Route Handler streams both |
| Captcha | **Cloudflare Turnstile** on contact/register | Env `TURNSTILE_*`; honeypot field as backup |
| Payments | **Razorpay + Stripe** | Razorpay default for IN; Stripe for international cards; catalog INR paise |
| Jobs | In-process cron Route Handler | Avoid Redis/BullMQ until volume requires it |
| Testing | **Vitest** (unit/component) + **Playwright** (auth, checkout, booking) | |
| Logging | **pino** JSON to stdout | Caddy + Docker logs |
| Errors | Optional **Sentry** behind `SENTRY_DSN` | |
| Package manager | **pnpm** | Lockfile + speed |
| Images | `next/image` + Caddy cache | |

---

## Security & Privacy Considerations

### Threat model (abridged)

| Threat | Sev | Mitigation |
| --- | --- | --- |
| Account takeover | High | Argon2id, verified email, reset tokens, Google OAuth. Ban/password-reset **increment `User.tokenVersion`**; `requireSession()` loads MySQL and rejects mismatched JWT / `BANNED` / `SUSPENDED` / `PENDING_VERIFICATION` |
| Child data exposure | High | Age gate, parental consent, non-public student profiles, no student PII to xAI |
| XSS via blogs/forum | High | TipTap JSON, sanitization, CSP |
| Malicious PDF/upload | High | MIME allowlist, 25 MB / 5 MB cap, sha256, never serve as inline HTML. **No ClamAV in v1** |
| Payment fraud / PAN storage | High | Razorpay + Stripe hosted checkout; **never store card PAN/CVV**; verify both webhooks |
| CSRF | Med | Server Actions + same-site cookies `AUTH_URL` |
| Privilege escalation | High | `requireRole` on every mutation; proxy is insufficient alone |
| Scraping / spam | Med | `proxy.ts` token bucket on `/login`, `/register`, `/api/auth/*` (those paths **are** in `matcher`); honeypot + **Turnstile** |
| Path traversal / ACL bypass | Med | Opaque keys; **no public MinIO proxy**; `GET /api/files/[id]` checks `acl` + entitlement |

### Child safety (K-12)

Archive invites students and parents. India **DPDP Act, 2023** treats anyone under **18** as a child and asks for **verifiable parental consent**. This rebuild is **DPDP-aware**, not a claim of full DPDP compliance.

v1 rules (all in **PR 04**, not a later cleanup PR):

1. Credentials register **requires DOB**. Age < 18 → hard block; “Ask a parent to create your account.”
2. Any OAuth `createUser` sets `PENDING_PROFILE`. `/complete-profile` requires DOB before `ACTIVE`. Under-18 OAuth accounts are not activated.
3. `student_self_register=false`. Only `PARENT` creates `STUDENT` rows.
4. Parental attestation: `Consent.type=PARENTAL_ATTESTATION` = checkbox + typed full name + timestamp + IP. **This is not verifiable parental consent** (no parent email/SMS OTP, no identity document). Accepted residual risk; do not market as “DPDP-compliant.”
5. Student profiles default `isProfilePublic=false`; directory omitted; no last name, school, phone, photo.
6. Students cannot follow arbitrary adults; cannot post in public feed. **No DM/inbox feature.**
7. Psychology Consultation for minors: parent is `customerId`; child named in notes; clinical-care disclaimer.

COPPA (US, under 13) is not the primary statute; we still refuse under-18 self-serve.

### DPDP / GDPR-style

- Privacy policy rewritten (Wix text mentions sharing with affiliates for marketing — tighten).
- Purpose limitation: account, community, bookings, orders, security.
- Data subject: export + delete in `/account/settings` (admin performs hard-delete of PII; retain invoice records as required by Indian tax law).
- Lawful basis: consent + contract.
- Data residency: DigitalOcean **blr1** (Bangalore) droplet neojn. MySQL and files stay on that host.

### Other

- CSP: default-src self; img-src self MinIO data https; script-src self; connect-src self Razorpay xAI.
- CSRF: Auth.js cookies `SameSite=Lax`, `Secure` in prod.
- File allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. Reject SVG/HTML/EXE.
- PCI: SAQ-A via Razorpay Checkout; no PAN in our DB/logs.
- Secrets: never in images; `AUTH_SECRET` ≥ 32 bytes.

---

## Observability

- **Logs:** pino JSON (`level`, `requestId`, `userId`, `route`, `ms`). No passwords, tokens, card data.
- **Health:** `GET /api/health` → `{ status: "ok", version }` liveness; `GET /api/ready` checks MySQL `SELECT 1` and MinIO head-bucket.
- **Metrics (small self-host):** log-based. Optional: Caddy `/metrics` if admin build; app counters for `bookings_confirmed`, `orders_paid`, `signups` written to `AuditEvent` daily rollup.
- **Errors:** Sentry optional. Always keep pino `error` stack.
- **Alerting:** host-level (disk, 5xx from Caddy logs). No PagerDuty required at this scale.
- **Uptime:** Caddy access logs + Uptime Kuma on a sibling container hitting `/api/health`.

---

## Rollout Plan

Feature flags (DB `FeatureFlag`):

| Key | Default | Meaning |
| --- | --- | --- |
| `registrations` | true | |
| `student_self_register` | **false** | |
| `community` | true | |
| `forum` | true | |
| `commerce` | true | Store + cart (two SKUs) |
| `commerce_physical` | **true** | Two stationery SKUs self-ship; emergency off switch |
| `bookings` | true | Calendar works; paid path if `pricePaise>0` |
| `wallet_spend` | **false** | |
| `ai_assistants` | **false** | |
| `events_registration` | true | |

Phased cutover from Wix:

1. Ship app on staging (or `127.0.0.1:3110` + hosts file) ; migrate content; staff QA.
2. Add `/etc/caddy/sites/eduvoq.caddy` + systemd unit + `eduvoq_db` on **neojn** without touching other sites.
3. Point DNS `@` + `www` A → `68.183.85.203`; freeze Wix blog; final post extract.
4. Cutover; Wix 301s if the wixsite is kept as a redirect.
5. Keep Wix unpublished after 14 days if no rollback need.

Rollback: revert DNS to Wix; app remains read-only. Because member data is new, rollback loses new signups — communicate a maintenance window.

Seed: admin user, editorial user, 68 posts, CMS pages, 2 products, 3 services, 2 groups, 1 plan, forum categories.

---

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Under-18 users lie about DOB / OAuth skip | High | Age gate on **credentials and all OAuth** (`PENDING_PROFILE`); no public student PII. Checkbox attestation is **not** verifiable consent (accepted) |
| Credentials + DB sessions (Auth.js footgun) | High | **JWT sessions** (KD); do not ship database-session Credentials |
| Wix content extraction lossy (nested spans, JS widgets) | Med | Editorial pass; do not auto-publish garbage; archive remains available |
| Razorpay/Stripe webhook missed / retried | High | `PaymentEvent` `@@unique([provider, providerEventId])`; both webhooks + cron; 15 min expiry |
| Forum spam | Med | Rate limits, captcha on first 3 posts, staff queue |
| Shared droplet crowded | High | 11 Next apps on 8 GB; cap EduVoq heap 384 MB; monitor RSS; migrate to own droplet later — **do not block launch** |
| Ubuntu 25.10 non-LTS | Med | Do not depend on 25.10-only packages; NodeSource LTS; plan host upgrade to 26.04 |
| Collide with existing Caddy/MySQL/ports | High | Dedicated `eduvoq.caddy`, `eduvoq_db`, port **3110** only; never reuse schoolyi/chessyi DBs |
| Scope explosion into school ERP | High | Non-goal: school-ops pages stay CMS landings |
| AI cost / leakage | Med | Flag off by default; no child content; token caps per user/day |
| Brand confusion EduVoq vs chalknpencil | Low | Canonical EduVoq; 301 old paths |
| Next.js 16 `proxy.ts` vs `middleware.ts` naming across minor versions | Low | Auth gate lives in one file; adapt to the stable API of the pinned version |

---

## Alternatives Considered

### 1. PostgreSQL vs MySQL

| | PostgreSQL | MySQL (chosen) |
| --- | --- | --- |
| Fit | Excellent for forum/full-text | Mandated; InnoDB + `@@fulltext` adequate at this scale |
| Auth.js | First-class | First-class Prisma adapter |
| Ops | Team may know it better | User constraint; Docker `mysql:8.4` |

**Decision:** MySQL wins because it is a **user-mandated constraint**. Postgres is not used.

### 2. Payload/Sanity vs in-app CMS

| | Sanity/Payload | In-app TipTap + `CmsPage`/`Post` |
| --- | --- | --- |
| Editor UX | Strong | Sufficient with shadcn + TipTap |
| Cost/ops | Extra service | One DB |
| Member-submitted blogs | Awkward | Native moderation workflow |

**Decision:** in-app CMS. EduVoq already is a community CMS, not a brochure site.

### 3. Stripe vs Razorpay vs both

| | Stripe only | Razorpay only | **Both (chosen)** |
| --- | --- | --- | --- |
| India UPI / netbanking | Weaker | Native | Razorpay default when billing country IN |
| International cards / NRI | Strong | Weaker | Stripe Checkout/PaymentIntents |
| Catalog currency | Extra FX if USD | INR paise | **INR paise** on both (prefer Stripe India) |
| PCI | SAQ-A | SAQ-A | Hosted checkout, no PAN |

**Decision (owner 2026-09-08):** both. Auto-select Razorpay for IN; “Pay with card (international)” → Stripe. One-time Orders/PaymentIntents only — no Subscriptions APIs.

### 4. nginx vs Caddy

| | nginx | Caddy (chosen) |
| --- | --- | --- |
| TLS | certbot extra | automatic HTTPS |
| Config | more knobs | mandated, simpler for small self-host |

**Decision:** Caddy. nginx only as alternative if ops already standardizes on it.

### 5. Separate Nest API vs Next Route Handlers

| | Nest | Next handlers/actions (chosen) |
| --- | --- | --- |
| Team size | Two deployables | One |
| Type sharing | extra packages | direct |
| Background jobs | natural | cron RH is enough now |

**Decision:** Next-only until job volume or a mobile API forces a split.

### 6. Better Auth vs Auth.js

Auth.js docs note the project is now part of Better Auth. **Stay on Auth.js v5** because the user mandated NextAuth/Auth.js and the Prisma adapter is documented. Revisit Better Auth in a later PR only if Auth.js maintenance stalls.

### 7. JWT sessions vs database sessions (Credentials)

| | Database sessions | JWT sessions (chosen) |
| --- | --- | --- |
| OAuth | Adapter `createSession` works | JWT still works |
| Credentials | Cookie token often has **no** `Session` row; `auth()` null | `authorize` return value copied into JWT |
| Revocation | Delete `Session` row | **`User.tokenVersion` + `requireSession()` MySQL check** (chosen). 14d JWT maxAge is not revocation. |
| Edge | Prisma often blocked | JWT works even on Edge |

**Decision:** JWT + Prisma adapter for User/Account. Alternative (not v1): `jwt.encode`/`decode` + `adapter.createSession` on credentials sign-in.

### 8. Object storage: MinIO prod vs local disk vs public proxy

| | Caddy `/media/*` → MinIO | MinIO container on neojn | **Local disk + RH (prod, chosen)** |
| --- | --- | --- | --- |
| RAM | — | Extra process on 8 GB box | None |
| Private PDFs | Easy to leak | OK if private bucket | `GET /api/files/[id]` after ACL |
| Dev parity | — | Compose MinIO (`FILE_DRIVER=s3`) | Same handler, different driver |

**Decision:** MinIO **dev only**. Prod `FILE_DRIVER=local` `/var/www/eduvoq/storage`. No public MinIO proxy.

### 9. First-party availability vs Google Calendar

| | Google Calendar | First-party `ExpertAvailability` (chosen) |
| --- | --- | --- |
| Ops | OAuth per expert | Admin/expert form |
| Concurrency | External races | DB unique + transaction |

Google Calendar sync is a later optional.

---

## Key Decisions

1. **Product identity:** community + consulting + content + light commerce for Indian school educators — **not** an LMS or school ERP. School-ops URLs are consulting landings.
2. **Single Next.js 16.3 App Router app** (TypeScript, `src/`), not a monorepo, not a separate API.
3. **MySQL 8.4 + Prisma** as the only datastore; money in paise; `cuid` IDs. PR 03 ships the **full** schema.
4. **Caddy:** Compose Caddy for **dev**. Prod = **host Caddy on neojn** (`/etc/caddy/sites/eduvoq.caddy`) reverse-proxy `www.eduvoq.com` → `127.0.0.1:3110`. Apex `eduvoq.com` 301 → `https://www.eduvoq.com{uri}`. Docker Compose is not used in production.
5. **Auth.js v5 + Prisma adapter + JWT sessions.** Providers: Credentials + **Google + Apple + Facebook + LinkedIn** (no GitHub). Every OAuth hits DOB/`PENDING_PROFILE`. Account linking explicit. Ban/reset increment `User.tokenVersion`; `requireSession()` re-reads MySQL. Cookie domain `.eduvoq.com`; `AUTH_URL=https://www.eduvoq.com`.
6. **Parent role is in. Student self-registration is off.** Age gate + Google `PENDING_PROFILE` ship in PR 04. Parental checkbox+name+IP is **attestation, not verifiable DPDP consent**.
7. **Forum is rebuilt in-app** (Wix Forum is dead). Groups seed Job Alerts + Social Network. **No DMs.**
8. **Portfolio gallery is a non-goal**; educator profile portfolios are the replacement.
9. **Do not clone placeholder products** (10 SKUs). v1 catalog = Student's Diary ₹188 + Time-table Arrangement Register ₹300 only.
10. **Razorpay + Stripe.** Razorpay Orders default for India (UPI/cards/netbanking, INR). Stripe Checkout/PaymentIntents for international cards (prefer Stripe India **INR**). Wallet spend off. Webinars plan = **₹10 one-time 3-month pack**, not Subscriptions APIs.
11. **Files:** MinIO in Compose only. Prod = local disk `/var/www/eduvoq/storage` + entitlement Route Handler. No Caddy `/media/*` proxy. No MinIO container on neojn.
12. **TipTap + in-app CMS** rather than Sanity/Payload.
13. **shadcn/ui + Tailwind + Zod + RHF + TanStack Query + Vitest + Playwright + pino**.
14. **AI is optional** (xAI `grok-4.5`); flag off; core product runs without it.
15. **Clean URL IA** with 301s from Wix paths (including both `/my-*` and `/account/my-*`).
16. **Brand + domain:** user-facing **EduVoq**. Canonical `https://www.eduvoq.com`. `chalknpencil` is historical. DNS A `@` and `www` → `68.183.85.203`.
17. **Cron via `CRON_SECRET` + `CronLease`**, not Redis/BullMQ, not a second Caddy site.
18. **Events feature exists**; Wix science-fair/field-trip boilerplate is not shipped.
19. **Resource Corner:** verified EDUCATOR/EXPERT/STAFF/ADMIN download `EDUCATOR_ONLY` files. `/sample-papers` is a public teaser; downloads require login. Paid pack does not gate the library.
20. **Cart is DB `Cart`/`CartItem`, member-only.** No guest checkout.
21. **Experts are admin-granted** after `hello@eduvoq.com` application — not a self-serve role.
22. **Consultation mode default ONLINE.** Customer’s Place remains an enum for Admission only. **Seed prices:** Career 1h ₹2,499; Psychology 1h ₹2,999; Admission 2h ₹4,999 (staff-editable).
23. **`/news` = `PostKind.NEWS`** on the same `Post` table. Founder bio publishes as migrated.
24. **PHYSICAL fulfillment is on** (`commerce_physical=true`). Self-ship India, no COD, no 3PL. Shipping metro ₹79 / rest of India ₹129. GST tax rate 0 until GSTIN known (ops, not a product OQ).
25. **Production host = neojn** (DO blr1). systemd + host MySQL `eduvoq_db` + port 3110. Heap cap 384 MB on a crowded 8 GB droplet.

### Owner Decisions (2026-09-08)

Final owner calls. Merchant IDs, OAuth client secrets, and SMTP passwords remain env vars — not product questions.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Domain | Canonical `https://www.eduvoq.com`; apex 301 → www |
| 2 | Host | DigitalOcean droplet **neojn**, `68.183.85.203`, blr1, host Caddy + systemd + `eduvoq_db` |
| 3 | Payments | **Both** Razorpay (IN default) and Stripe (international); INR paise |
| 4 | Consult prices | ₹2,499 / ₹2,999 / ₹4,999 as table above |
| 5 | Auth | Credentials + Google + Apple + Facebook + LinkedIn (no GitHub). SMTP still env. |
| 6 | Physical | Enable; self-ship; metro ₹79 / RoI ₹129; no COD |

---

## Open Questions

**None remaining as product decisions.** The six owner questions are closed in the table above.

Still operational (env/secrets, not architecture):

- Razorpay / Stripe dashboard keys and webhook secrets
- Google / Apple / Facebook / LinkedIn OAuth client IDs and secrets
- SMTP credentials for `hello@eduvoq.com`
- MySQL user password for `eduvoq`@localhost (create on neojn; never commit)
- GSTIN when the operator registers (until then `taxPaise=0`)

---

## References

- Archive README: `chalknpencil-archive/meta/README.md`
- Browser pages: `chalknpencil-archive/meta/browser-pages.json` (54)
- URL inventory: `chalknpencil-archive/meta/urls-content.txt`, `urls.txt` (582 discovered)
- Sitemaps: `chalknpencil-archive/meta/sitemaps/` (`pages`, `blog-posts` 68, `blog-categories`, `store-products`, `store-categories`, `booking-services`, `event-pages`, `portfolio-*`, `member-profile`)
- Source site: https://eduvoq.wixsite.com/chalknpencil
- About / mission / founder: `chalknpencil-archive/wget/eduvoq.wixsite.com/chalknpencil/about-us.html`
- Next.js 16.3 docs: https://nextjs.org/docs
- Auth.js Prisma adapter: https://authjs.dev/getting-started/adapters/prisma
- xAI API: `https://api.x.ai/v1` (OpenAI-compatible)
- India DPDP Act, 2023 (child = under 18, verifiable parental consent)

---

## PR Plan

Each PR is independently reviewable and mergeable. Later PRs sit behind feature flags.

**Calendar:** ~**14–18 engineer-weeks** for one senior (or ~8–10 weeks for two), assuming commerce/bookings/AI flags can slip. Twenty PRs over 2–4 months matches a small self-host launch; do not parallelize Auth (04) before schema (03).

### PR 01 — Repository foundation

- **Files:** `package.json`, `tsconfig.json`, `next.config.ts` (`output: "standalone"`), `src/app/layout.tsx`, `src/app/page.tsx` placeholder, Tailwind, ESLint, pnpm lockfile, `.env.example`, `Dockerfile`, `docker-compose.yml` (mysql, app), README (dev only)
- **Depends on:** none
- **Description:** Next.js 16.3 + TypeScript + Tailwind app boots locally and in Compose.

### PR 02 — Caddy local proxy + health

- **Files:** `caddy/Caddyfile.local`, compose `caddy` + `mailpit`, `src/app/api/health/route.ts`, `src/app/api/ready/route.ts`, pino
- **Depends on:** PR 01
- **Description:** Browser → Caddy :80 → Next :3000. **No MinIO proxy.**

### PR 03 — Prisma + MySQL **full schema**

- **Files:** complete `prisma/schema.prisma` (this document’s models, including Cart, PaymentEvent, CronLease, Resource.status, Booking.meetingUrl, FileObject without Product.images), `src/server/db.ts`, first migration, seed admin
- **Depends on:** PR 01
- **Description:** Multiline enums (one value per line). `User.cart Cart?` 1:1. `prisma validate` passes on this outline. Later PRs do not add tables, only seed/UI.

### PR 04 — Auth.js JWT + Credentials + social logins + age gate

- **Files:** `src/auth.ts` (JWT + wrapped adapter `generateUsername` + `tokenVersion`; providers Credentials, Google, Apple, Facebook, LinkedIn), `[...nextauth]/route.ts`, `src/proxy.ts` (matcher includes `/login` `/register` `/api/auth/:path*`), `src/server/rbac.ts` (`requireSession` MySQL re-read), `/login` UI (email form + Continue with Google/Apple/Facebook/LinkedIn), `/register` `/forgot-password` `/verify-email` `/complete-profile`, parent-child create, `Consent` TOS + `PARENTAL_ATTESTATION`, argon2, Playwright: under-18 blocked, **every OAuth** pending profile, credentials session survives reload, ban invalidates next action
- **Depends on:** PR 03, PR 02 (SMTP)
- **Description:** JWT sessions. DOB on **all** signup paths. `student_self_register=false`. Cookie domain `.eduvoq.com` in prod.

### PR 05 — Design system + public chrome

- **Files:** shadcn, Header/Footer/Nav, 404
- **Depends on:** PR 01
- **Description:** EduVoq chrome; Wix nav clusters.

### PR 06 — Marketing CMS routes (no admin editor)

- **Files:** `/about` `/contact` `/careers` `/privacy` `/terms` `/pricing` `/services` `/services/[slug]` `/news` (`PostKind.NEWS`), contact action + Turnstile, seed `CmsPage`
- **Depends on:** PR 03, PR 05
- **Description:** Public landings from seed. TipTap **admin** editor is PR 16.

### PR 07 — Blog + RSS + SEO

- **Files:** `/blog`, `/blog/[slug]`, categories, tags, `/rss.xml`, `/sitemap.xml`, submit → `IN_REVIEW`
- **Depends on:** PR 03–06
- **Description:** Blog surface; staff moderate in PR 16.

### PR 08 — Wix extraction scripts

- **Files:** `scripts/migrate-wix/*`, `redirects.json` (including `/my-*` and `/account/my-*`), seed 68 posts
- **Depends on:** PR 07
- **Description:** Deterministic extract from `chalknpencil-archive/`.

### PR 09 — Profiles, directory, follows, student privacy

- **Files:** `/members`, `/members/[username]`, `/account`, `/account/settings`, Follow, notifications shell, student directory rules, account linking UI
- **Depends on:** PR 04, PR 05
- **Description:** Public educator directory; students hidden. Legal rewrite of privacy/terms can land here (copy, not new auth gates).

### PR 10 — Forum rebuild

- **Files:** `/forum`, threads, `ForumPost.parentId`, `Reaction`, `Report`
- **Depends on:** PR 09
- **Description:** Replaces discontinued Wix Forum.

### PR 11 — Social feed + groups

- **Files:** `/community`, `/groups`, seed job-alerts + social-network, `PollVote`
- **Depends on:** PR 09
- **Description:** Wix Groups analogue. No DMs.

### PR 12 — File storage + Resource Corner

- **Files:** compose pinned MinIO (dev), `src/lib/storage/{s3,local}.ts`, `FILE_DRIVER`, `GET /api/files/[id]`, `/resources/*`, entitlement matrix, sample-papers public teaser
- **Depends on:** PR 04, PR 03
- **Description:** Prod streams from `/var/www/eduvoq/storage`. MIME allowlist + size cap; no ClamAV; no MinIO on neojn.

### PR 13 — Consultations + bookings (concurrency)

- **Files:** `/consult`, `/book/[slug]`, slot RH, `createBooking` transaction + unique slot, expert assignment, `meetingUrl`, reminder cron + `CronLease`
- **Depends on:** PR 04, PR 02
- **Description:** Three services seeded at ₹2,499 / ₹2,999 / ₹4,999. Paid path via Razorpay or Stripe.

### PR 14 — Commerce catalog + cart + self-ship

- **Files:** `/store`, product pages, `/cart`, `/checkout` (address + metro/RoI shipping), `/account/orders|addresses`, seed two SKUs, `ShippingRate` seed ₹79/₹129, stock lock, GST columns, `commerce_physical=true`
- **Depends on:** PR 04, PR 12 (PUBLIC product images)
- **Description:** No placeholders. Self-ship India, no COD. Orders stay `PENDING_PAYMENT` until PR 15.

### PR 15 — Razorpay + Stripe + webinar pack + wallet shell

- **Files:** `src/lib/payments/{razorpay,stripe}.ts`, `/api/webhooks/razorpay`, `/api/webhooks/stripe`, `PaymentEvent` `@@unique([provider, providerEventId])`, 15 min expiry, checkout gateway picker (IN → Razorpay; international card → Stripe), `/pricing` one-time pack, `/account/subscriptions`, `/account/wallet` display-only, Playwright checkout both gateways
- **Depends on:** PR 13, PR 14, PR 06
- **Description:** **No Razorpay Subscriptions / Stripe Billing.** Pack is a one-time order. INR paise on both.

### PR 16 — Admin console + events

- **Files:** `/admin` (users, TipTap pages, posts, reports, bookings, orders, resources, flags, grant EXPERT, audit), `/events`
- **Depends on:** PR 07, PR 13, PR 14
- **Description:** Single admin surface.

### PR 17 — neojn production: Caddy site, systemd, MySQL, backups

- **Files:** `/etc/caddy/sites/eduvoq.caddy` snippet in repo `caddy/eduvoq.caddy`, `deploy/eduvoq.service`, `.env.example` prod, `scripts/backup-eduvoq-db.sh` (mysqldump **`eduvoq_db` only**), systemd timer for cron `127.0.0.1:3110/api/cron`, DNS runbook (`@` + `www` A → `68.183.85.203`)
- **Depends on:** PR 02, PR 15
- **Description:** Install on **existing** neojn host Caddy + systemd pack (schoolyi pattern). Create MySQL user `eduvoq` / database `eduvoq_db`. Bind `127.0.0.1:3110`. Local disk `storage/`. **No** Compose on the droplet, **no** new VPS, **no** MinIO container. Heap 384 MB. Backup `eduvoq_db` only.

### PR 18 — Optional AI module (xAI)

- **Files:** `src/lib/ai/*`, lesson-plan + blog-draft, flag `ai_assistants`
- **Depends on:** PR 07, PR 12
- **Description:** Optional; product works if never merged.

### PR 19 — Polish, redirects, cutover

- **Files:** remaining 301s, OG images, a11y, Playwright register→post/book/checkout, homepage copy
- **Depends on:** PR 08, PR 11–16
- **Description:** Cutover-ready; DNS runbook.

(Former PR 17 “DPDP after community” is folded into PR 04/09. Former PR 20 is now 19.)

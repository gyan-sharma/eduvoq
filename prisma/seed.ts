import {
  ConsultationMode,
  PrismaClient,
  ProductType,
  Role,
  UserStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

function richText(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

async function main() {
  // passwordHash is left null on purpose: this PR does not add argon2.
  // Auth.js (PR 04) hashes with @node-rs/argon2. Set the admin password after
  // that lands, or via a one-off script — do not commit a real hash.
  await prisma.user.upsert({
    where: { email: "admin@eduvoq.com" },
    update: {
      username: "admin",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "admin@eduvoq.com",
      username: "admin",
      name: "EduVoq Admin",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  await prisma.shippingRate.upsert({
    where: { slug: "metro" },
    update: { name: "Metro", paise: 7900 },
    create: { slug: "metro", name: "Metro", paise: 7900 },
  });

  await prisma.shippingRate.upsert({
    where: { slug: "rest_of_india" },
    update: { name: "Rest of India", paise: 12900 },
    create: { slug: "rest_of_india", name: "Rest of India", paise: 12900 },
  });

  const services = [
    {
      slug: "career-options-counselling",
      title: "Career Options and Counselling",
      durationMinutes: 60,
      pricePaise: 249900,
      description:
        "One-hour career options and counselling session for students and parents.",
    },
    {
      slug: "psychology-consultation",
      title: "Psychology Consultation",
      durationMinutes: 60,
      pricePaise: 299900,
      description: "One-hour psychology consultation for K-12 stakeholders.",
    },
    {
      slug: "admission-consulting-advisory",
      title: "Admission Consulting & Advisory",
      durationMinutes: 120,
      pricePaise: 499900,
      description: "Two-hour admission consulting and advisory session.",
    },
  ] as const;

  for (const service of services) {
    await prisma.consultationService.upsert({
      where: { slug: service.slug },
      update: {
        title: service.title,
        descriptionJson: richText(service.description),
        durationMinutes: service.durationMinutes,
        pricePaise: service.pricePaise,
        mode: ConsultationMode.ONLINE,
        isActive: true,
      },
      create: {
        slug: service.slug,
        title: service.title,
        descriptionJson: richText(service.description),
        durationMinutes: service.durationMinutes,
        pricePaise: service.pricePaise,
        mode: ConsultationMode.ONLINE,
        isActive: true,
      },
    });
  }

  const category = await prisma.productCategory.upsert({
    where: { slug: "all-products" },
    update: { name: "All Products" },
    create: { slug: "all-products", name: "All Products" },
  });

  await prisma.product.upsert({
    where: { sku: "EV-DIARY-001" },
    update: {
      slug: "student-s-diary",
      name: "Student's Diary",
      descriptionJson: richText(
        "Academic planning diary for students.",
      ),
      type: ProductType.PHYSICAL,
      pricePaise: 18800,
      currency: "INR",
      stock: 100,
      isActive: true,
      categoryId: category.id,
    },
    create: {
      slug: "student-s-diary",
      name: "Student's Diary",
      descriptionJson: richText(
        "Academic planning diary for students.",
      ),
      type: ProductType.PHYSICAL,
      pricePaise: 18800,
      currency: "INR",
      sku: "EV-DIARY-001",
      stock: 100,
      isActive: true,
      categoryId: category.id,
    },
  });

  await prisma.product.upsert({
    where: { sku: "EV-TTREG-001" },
    update: {
      slug: "time-table-arrangement-register",
      name: "Time-table Arrangement Register",
      descriptionJson: richText(
        "Quality-paper register for educators and students.",
      ),
      type: ProductType.PHYSICAL,
      pricePaise: 30000,
      currency: "INR",
      stock: 100,
      isActive: true,
      categoryId: category.id,
    },
    create: {
      slug: "time-table-arrangement-register",
      name: "Time-table Arrangement Register",
      descriptionJson: richText(
        "Quality-paper register for educators and students.",
      ),
      type: ProductType.PHYSICAL,
      pricePaise: 30000,
      currency: "INR",
      sku: "EV-TTREG-001",
      stock: 100,
      isActive: true,
      categoryId: category.id,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "webinars-guidance" },
    update: {
      name: "Webinars and Guidance",
      description:
        "One-time webinar pack: ₹10, valid for 3 months. Entitles webinars only — not the educator resource library.",
      pricePaise: 1000,
      interval: "once",
      durationMonths: 3,
      entitlements: { webinars: true },
    },
    create: {
      slug: "webinars-guidance",
      name: "Webinars and Guidance",
      description:
        "One-time webinar pack: ₹10, valid for 3 months. Entitles webinars only — not the educator resource library.",
      pricePaise: 1000,
      interval: "once",
      durationMonths: 3,
      entitlements: { webinars: true },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

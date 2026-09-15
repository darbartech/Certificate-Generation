/**
 * Canonical course catalog seed data.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT — source-of-truth note (read before editing)
 * ---------------------------------------------------------------------------
 * The public catalog at https://darbarcomputer.vercel.app/courses renders
 * client-side ("Loading course catalog...") and its backing data source/API
 * lives in the DarbarTech marketing site's own codebase, which is a separate
 * project this admin system does not have access to. That means this admin
 * project cannot currently call a live canonical API for course data.
 *
 * v2 UPDATE (2026-09-13): The catalog below was replaced wholesale from
 * DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md — 37 courses across
 * 15 categories, restyled so every module Subtitle is a short tool/skill
 * name list (e.g. "Word, Excel, PowerPoint") instead of a descriptive
 * sentence, matching the working Aayara reference certificate's style and
 * reliably fitting the fixed v2 module tiles without hitting the
 * shrink-to-fit floor. Every title/subtitle in this file was machine-checked
 * against the v2 rule (title <=16 chars, subtitle <=30 chars) at import time.
 *
 * Two entries from the pre-v2 catalog are intentionally KEPT rather than
 * replaced:
 *   - PCDSP-001 "Professional Computer & Digital Skills Program": the Aayara
 *     reference-program course used by the admin's quick-fill dropdown to
 *     reproduce the supplied "Certificate of Aayara final.pdf" verbatim.
 *   - MERN-QADEMO-001 "MERN Full Stack Engineering (QA Demo)": kept as a
 *     5-module course specifically so the admin's template-compatibility /
 *     overflow warning has a real course to demonstrate against. Renamed
 *     from the plain "MERN Full Stack Engineering" title to avoid colliding
 *     with the real 4-module MERN course now supplied by the v2 catalog.
 *
 * completionStatement: the v2 source markdown does not define per-course
 * completion statements, so every generated entry below carries a generic
 * placeholder marked with a TODO comment. Replace these with
 * DarbarTech-approved wording before issuing real certificates against them.
 *
 * If/when DarbarTech exposes a real course API (or shares direct DB access),
 * replace the static array below with a fetch to that API inside
 * `loadCanonicalCourseCatalog()`. Nothing else in the app needs to change —
 * both the Supabase seed path (src/lib/database/index.ts) and the in-memory
 * fallback (src/lib/database/inMemoryDb.ts) already read only from this one
 * function, so there is exactly one course list, not two.
 * ---------------------------------------------------------------------------
 */

export type CourseCatalogModuleSeed = {
  sort_order: number;
  title: string;
  subtitle?: string;
  active: boolean;
};

export type CourseCatalogSeed = {
  code: string;
  title: string;
  duration: string;
  active: boolean;
  certificateTitle: string;
  certificateTemplateId: string;
  certificateTemplateVersion: string;
  providerName: string;
  completionStatement: string;
  modules: CourseCatalogModuleSeed[];
};

const CANONICAL_COURSE_CATALOG: CourseCatalogSeed[] = [
  {
    // Aayara reference-program exact modules. Used by the admin quick-fill
    // dropdown to produce a PDF that visually reproduces the supplied
    // "Certificate of Aayara final.pdf" module list verbatim. KEPT as-is
    // across the v2 catalog import — do not remove without checking the
    // admin quick-fill flow first.
    code: "PCDSP-001",
    title: "Professional Computer & Digital Skills Program",
    duration: "4 Months",
    active: true,
    certificateTitle: "Professional Computer & Digital Skills Program",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    completionStatement:
      "has successfully completed all required course modules and demonstrated practical competency in the skills covered by the program.",
    modules: [
      {
        sort_order: 1,
        title: "COMPUTER FUNDAMENTALS",
        subtitle: "Basic Computer Operations",
        active: true,
      },
      {
        sort_order: 2,
        title: "OFFICE APPLICATIONS",
        subtitle: "Microsoft Word | Excel | PowerPoint",
        active: true,
      },
      {
        sort_order: 3,
        title: "GRAPHIC DESIGN",
        subtitle: "Adobe Photoshop | Illustrator | Canva",
        active: true,
      },
      {
        sort_order: 4,
        title: "NEPALI TYPING",
        subtitle: "Unicode \u00b7 Traditional Nepali Typing",
        active: true,
      },
    ],
  },
  {
    // Kept ONLY to exercise the admin's template-compatibility warning for
    // courses with more learning objectives than the template's fixed 4
    // tiles. Renamed with a QADEMO code/title so it no longer collides with
    // the real 4-module "MERN Full Stack Engineering" course below.
    code: "MERN-QADEMO-001",
    title: "MERN Full Stack Engineering (QA Demo - 5 Modules)",
    duration: "24 Weeks",
    active: false,
    certificateTitle: "MERN Full Stack Engineering",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    completionStatement:
      "has successfully completed all prescribed modules and demonstrated competence building and deploying full-stack production applications.",
    modules: [
      { sort_order: 1, title: "REST API DESIGN", subtitle: "Node.js & Express", active: true },
      { sort_order: 2, title: "DATABASE ENGINEERING", subtitle: "MongoDB & MySQL", active: true },
      { sort_order: 3, title: "AUTHENTICATION & SECURITY", subtitle: "JWT & Access Control", active: true },
      { sort_order: 4, title: "DEPLOYMENT & CI/CD", subtitle: "Docker & Continuous Delivery Basics", active: true },
      { sort_order: 5, title: "CAPSTONE PROJECT", subtitle: "Ecommerce Platform | Job Portal | Social App", active: true },
    ],
  },
  {
    // Category: Basic Computer
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "DLE-001",
    title: "Digital Literacy Essentials",
    duration: "4 Weeks",
    active: true,
    certificateTitle: "Digital Literacy Essentials",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "OS & FILES",
        subtitle: "Windows, Folders",
        active: true,
      },
      {
        sort_order: 2,
        title: "INTERNET",
        subtitle: "Browser, Email",
        active: true,
      },
      {
        sort_order: 3,
        title: "AI TOOLS",
        subtitle: "ChatGPT, Gemini",
        active: true,
      },
      {
        sort_order: 4,
        title: "SAFETY",
        subtitle: "Passwords, Privacy",
        active: true,
      },
    ],
  },
  {
    // Category: Basic Computer
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "STM-001",
    title: "Speed Typing Mastery",
    duration: "4 Weeks",
    active: true,
    certificateTitle: "Speed Typing Mastery",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "TOUCH TYPING",
        subtitle: "Finger Technique",
        active: true,
      },
      {
        sort_order: 2,
        title: "ENGLISH TYPING",
        subtitle: "Speed & Accuracy",
        active: true,
      },
      {
        sort_order: 3,
        title: "NEPALI TYPING",
        subtitle: "Unicode, Traditional",
        active: true,
      },
      {
        sort_order: 4,
        title: "SPEED TEST",
        subtitle: "Timed Practice",
        active: true,
      },
    ],
  },
  {
    // Category: Basic Computer
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "PCO-001",
    title: "Professional Computer Operator",
    duration: "12 Weeks",
    active: true,
    certificateTitle: "Professional Computer Operator",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "TYPING",
        subtitle: "English, Nepali",
        active: true,
      },
      {
        sort_order: 2,
        title: "MS OFFICE",
        subtitle: "Word, Excel, PowerPoint",
        active: true,
      },
      {
        sort_order: 3,
        title: "INTERNET",
        subtitle: "Email, Browsing",
        active: true,
      },
      {
        sort_order: 4,
        title: "DATA ENTRY",
        subtitle: "Office Etiquette",
        active: true,
      },
    ],
  },
  {
    // Category: Office Productivity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "MOP-001",
    title: "Microsoft Office Professional",
    duration: "6 Weeks",
    active: true,
    certificateTitle: "Microsoft Office Professional",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "MS WORD",
        subtitle: "Documents",
        active: true,
      },
      {
        sort_order: 2,
        title: "MS EXCEL",
        subtitle: "Formulas, Tables",
        active: true,
      },
      {
        sort_order: 3,
        title: "MS POWERPOINT",
        subtitle: "Slides, Design",
        active: true,
      },
      {
        sort_order: 4,
        title: "MS OUTLOOK",
        subtitle: "Email, Calendar",
        active: true,
      },
    ],
  },
  {
    // Category: Office Productivity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "AEP-001",
    title: "Advanced Excel for Professionals",
    duration: "4 Weeks",
    active: true,
    certificateTitle: "Advanced Excel for Professionals",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "FORMULAS",
        subtitle: "VLOOKUP, IF",
        active: true,
      },
      {
        sort_order: 2,
        title: "PIVOT TABLES",
        subtitle: "Data Summary",
        active: true,
      },
      {
        sort_order: 3,
        title: "DASHBOARDS",
        subtitle: "Charts, Graphs",
        active: true,
      },
      {
        sort_order: 4,
        title: "MACROS",
        subtitle: "VBA Basics",
        active: true,
      },
    ],
  },
  {
    // Category: Office Productivity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "AOA-001",
    title: "AI Office Administration",
    duration: "4 Weeks",
    active: true,
    certificateTitle: "AI Office Administration",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "AI WRITING",
        subtitle: "Docs, Drafting",
        active: true,
      },
      {
        sort_order: 2,
        title: "AI SPREADSHEETS",
        subtitle: "Copilot, Analysis",
        active: true,
      },
      {
        sort_order: 3,
        title: "AI SCHEDULING",
        subtitle: "Calendar Tools",
        active: true,
      },
      {
        sort_order: 4,
        title: "AI EMAIL",
        subtitle: "Smart Replies",
        active: true,
      },
    ],
  },
  {
    // Category: Programming Foundations
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "SDF-001",
    title: "Software Development Foundation",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "Software Development Foundation",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "LOGIC",
        subtitle: "Loops, Conditionals",
        active: true,
      },
      {
        sort_order: 2,
        title: "C & PYTHON",
        subtitle: "Core Syntax",
        active: true,
      },
      {
        sort_order: 3,
        title: "OOP",
        subtitle: "Classes, Objects",
        active: true,
      },
      {
        sort_order: 4,
        title: "GIT",
        subtitle: "GitHub, Version Control",
        active: true,
      },
    ],
  },
  {
    // Category: Programming Foundations
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "DCP-001",
    title: "DSA & Competitive Programming",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "DSA & Competitive Programming",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "ARRAYS",
        subtitle: "Strings, Lists",
        active: true,
      },
      {
        sort_order: 2,
        title: "TREES",
        subtitle: "Linked Lists",
        active: true,
      },
      {
        sort_order: 3,
        title: "SORTING",
        subtitle: "Searching",
        active: true,
      },
      {
        sort_order: 4,
        title: "CONTESTS",
        subtitle: "Practice Problems",
        active: true,
      },
    ],
  },
  {
    // Category: Web Development
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "MFE-001",
    title: "Modern Frontend Engineering",
    duration: "16 Weeks",
    active: true,
    certificateTitle: "Modern Frontend Engineering",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "HTML CSS JS",
        subtitle: "Web Basics",
        active: true,
      },
      {
        sort_order: 2,
        title: "REACT",
        subtitle: "Next.js",
        active: true,
      },
      {
        sort_order: 3,
        title: "TAILWIND",
        subtitle: "CSS Styling",
        active: true,
      },
      {
        sort_order: 4,
        title: "AI CODING",
        subtitle: "Copilot, Cursor",
        active: true,
      },
    ],
  },
  {
    // Category: Web Development
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "BENL-001",
    title: "Backend Engineering with Node & Laravel",
    duration: "16 Weeks",
    active: true,
    certificateTitle: "Backend Engineering with Node & Laravel",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "NODE.JS",
        subtitle: "Express",
        active: true,
      },
      {
        sort_order: 2,
        title: "LARAVEL",
        subtitle: "PHP",
        active: true,
      },
      {
        sort_order: 3,
        title: "REST APIS",
        subtitle: "Postman",
        active: true,
      },
      {
        sort_order: 4,
        title: "MYSQL",
        subtitle: "Auth, JWT",
        active: true,
      },
    ],
  },
  {
    // Category: Web Development
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "MFSE-001",
    title: "MERN Full Stack Engineering",
    duration: "24 Weeks",
    active: true,
    certificateTitle: "MERN Full Stack Engineering",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "MONGODB",
        subtitle: "Express",
        active: true,
      },
      {
        sort_order: 2,
        title: "REACT",
        subtitle: "Redux",
        active: true,
      },
      {
        sort_order: 3,
        title: "AUTH",
        subtitle: "JWT, OAuth",
        active: true,
      },
      {
        sort_order: 4,
        title: "DEPLOYMENT",
        subtitle: "Docker, CI/CD",
        active: true,
      },
    ],
  },
  {
    // Category: Web Development
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "NJWD-001",
    title: "Next.js & WordPress Development",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Next.js & WordPress Development",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "NEXT.JS",
        subtitle: "Static Sites",
        active: true,
      },
      {
        sort_order: 2,
        title: "WORDPRESS",
        subtitle: "Themes, Plugins",
        active: true,
      },
      {
        sort_order: 3,
        title: "CLIENT SITES",
        subtitle: "Real Projects",
        active: true,
      },
      {
        sort_order: 4,
        title: "SEO",
        subtitle: "Deployment",
        active: true,
      },
    ],
  },
  {
    // Category: Mobile App Development
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "MAD-001",
    title: "Mobile App Development",
    duration: "12 Weeks",
    active: true,
    certificateTitle: "Mobile App Development",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "UI DESIGN",
        subtitle: "Figma",
        active: true,
      },
      {
        sort_order: 2,
        title: "REACT NATIVE",
        subtitle: "Cross-Platform",
        active: true,
      },
      {
        sort_order: 3,
        title: "APIS",
        subtitle: "Firebase",
        active: true,
      },
      {
        sort_order: 4,
        title: "APP STORE",
        subtitle: "Play Store",
        active: true,
      },
    ],
  },
  {
    // Category: AI & Automation
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "PEM-001",
    title: "Prompt Engineering Masterclass",
    duration: "3 Weeks",
    active: true,
    certificateTitle: "Prompt Engineering Masterclass",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "PROMPTING",
        subtitle: "Structured Prompts",
        active: true,
      },
      {
        sort_order: 2,
        title: "AI CHAT",
        subtitle: "ChatGPT, Claude, Gemini",
        active: true,
      },
      {
        sort_order: 3,
        title: "AI MEDIA",
        subtitle: "Images, Video",
        active: true,
      },
      {
        sort_order: 4,
        title: "PROMPT KIT",
        subtitle: "Reusable Templates",
        active: true,
      },
    ],
  },
  {
    // Category: AI & Automation
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "AAA-001",
    title: "Agentic AI & Automation",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Agentic AI & Automation",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "AI AGENTS",
        subtitle: "LLM Basics",
        active: true,
      },
      {
        sort_order: 2,
        title: "LLM APIS",
        subtitle: "OpenAI, Claude",
        active: true,
      },
      {
        sort_order: 3,
        title: "AUTOMATION",
        subtitle: "n8n, Zapier",
        active: true,
      },
      {
        sort_order: 4,
        title: "AGENT BUILD",
        subtitle: "Real Project",
        active: true,
      },
    ],
  },
  {
    // Category: AI & Automation
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "LRSD-001",
    title: "LLM & RAG Systems Development",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "LLM & RAG Systems Development",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "LLMs",
        subtitle: "Transformers",
        active: true,
      },
      {
        sort_order: 2,
        title: "RAG",
        subtitle: "Vector DBs",
        active: true,
      },
      {
        sort_order: 3,
        title: "MCP",
        subtitle: "Frameworks",
        active: true,
      },
      {
        sort_order: 4,
        title: "DEPLOYMENT",
        subtitle: "Production AI",
        active: true,
      },
    ],
  },
  {
    // Category: AI & Automation
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "CTAA-001",
    title: "Career Track: AI Automation Specialist",
    duration: "20 Weeks",
    active: true,
    certificateTitle: "Career Track: AI Automation Specialist",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "AI TOOLS",
        subtitle: "ChatGPT, Claude",
        active: true,
      },
      {
        sort_order: 2,
        title: "AUTOMATION",
        subtitle: "No-Code Tools",
        active: true,
      },
      {
        sort_order: 3,
        title: "AI AGENTS",
        subtitle: "Multi-Step Flows",
        active: true,
      },
      {
        sort_order: 4,
        title: "PORTFOLIO",
        subtitle: "Capstone Project",
        active: true,
      },
    ],
  },
  {
    // Category: AI Software Engineering
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "PAE-001",
    title: "Python for AI Engineering",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Python for AI Engineering",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "PYTHON",
        subtitle: "Syntax, Logic",
        active: true,
      },
      {
        sort_order: 2,
        title: "NUMPY PANDAS",
        subtitle: "Data Handling",
        active: true,
      },
      {
        sort_order: 3,
        title: "AI LIBRARIES",
        subtitle: "Scikit-learn",
        active: true,
      },
      {
        sort_order: 4,
        title: "AI PROJECTS",
        subtitle: "Mini Builds",
        active: true,
      },
    ],
  },
  {
    // Category: AI Software Engineering
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "AASE-001",
    title: "Advanced AI Software Engineering Diploma",
    duration: "48 Weeks",
    active: true,
    certificateTitle: "Advanced AI Software Engineering Diploma",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "FULL STACK",
        subtitle: "MERN, Next.js",
        active: true,
      },
      {
        sort_order: 2,
        title: "AI INTEGRATION",
        subtitle: "OpenAI APIs",
        active: true,
      },
      {
        sort_order: 3,
        title: "CLOUD",
        subtitle: "AWS, Azure",
        active: true,
      },
      {
        sort_order: 4,
        title: "CAPSTONE",
        subtitle: "Flagship Project",
        active: true,
      },
    ],
  },
  {
    // Category: Machine Learning & Data Science
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "MLDL-001",
    title: "Machine Learning & Deep Learning",
    duration: "16 Weeks",
    active: true,
    certificateTitle: "Machine Learning & Deep Learning",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "ML BASICS",
        subtitle: "Regression",
        active: true,
      },
      {
        sort_order: 2,
        title: "NEURAL NETS",
        subtitle: "Deep Learning",
        active: true,
      },
      {
        sort_order: 3,
        title: "MODEL TRAINING",
        subtitle: "TensorFlow",
        active: true,
      },
      {
        sort_order: 4,
        title: "PROJECTS",
        subtitle: "Case Studies",
        active: true,
      },
    ],
  },
  {
    // Category: Data & Business Intelligence
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "DAPB-001",
    title: "Data Analytics with Power BI",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Data Analytics with Power BI",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "DATA CLEANING",
        subtitle: "Excel, Power Query",
        active: true,
      },
      {
        sort_order: 2,
        title: "POWER BI",
        subtitle: "Dashboards",
        active: true,
      },
      {
        sort_order: 3,
        title: "DAX",
        subtitle: "Data Modeling",
        active: true,
      },
      {
        sort_order: 4,
        title: "REPORTING",
        subtitle: "Business Cases",
        active: true,
      },
    ],
  },
  {
    // Category: Data & Business Intelligence
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "DESB-001",
    title: "Data Engineering with SQL & Big Data",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "Data Engineering with SQL & Big Data",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "SQL",
        subtitle: "Queries, Joins",
        active: true,
      },
      {
        sort_order: 2,
        title: "MODELING",
        subtitle: "Schemas",
        active: true,
      },
      {
        sort_order: 3,
        title: "BIG DATA",
        subtitle: "Spark, Hadoop",
        active: true,
      },
      {
        sort_order: 4,
        title: "ETL",
        subtitle: "Pipelines",
        active: true,
      },
    ],
  },
  {
    // Category: Cloud & DevOps
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "CDE-001",
    title: "Cloud & DevOps Engineering",
    duration: "12 Weeks",
    active: true,
    certificateTitle: "Cloud & DevOps Engineering",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "CLOUD",
        subtitle: "AWS, Azure",
        active: true,
      },
      {
        sort_order: 2,
        title: "LINUX",
        subtitle: "Servers",
        active: true,
      },
      {
        sort_order: 3,
        title: "DOCKER",
        subtitle: "Containers",
        active: true,
      },
      {
        sort_order: 4,
        title: "CI/CD",
        subtitle: "Automation",
        active: true,
      },
    ],
  },
  {
    // Category: Graphic & Brand Design
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "CGDM-001",
    title: "Creative Graphic Design Masterclass",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "Creative Graphic Design Masterclass",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "DESIGN BASICS",
        subtitle: "Color, Typography",
        active: true,
      },
      {
        sort_order: 2,
        title: "PHOTOSHOP",
        subtitle: "Editing",
        active: true,
      },
      {
        sort_order: 3,
        title: "ILLUSTRATOR",
        subtitle: "Vector Art",
        active: true,
      },
      {
        sort_order: 4,
        title: "PORTFOLIO",
        subtitle: "Client Projects",
        active: true,
      },
    ],
  },
  {
    // Category: Graphic & Brand Design
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "BIPD-001",
    title: "Brand Identity & Packaging Design",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Brand Identity & Packaging Design",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "LOGO DESIGN",
        subtitle: "Illustrator",
        active: true,
      },
      {
        sort_order: 2,
        title: "BRAND GUIDE",
        subtitle: "Style Systems",
        active: true,
      },
      {
        sort_order: 3,
        title: "PACKAGING",
        subtitle: "Mockups",
        active: true,
      },
      {
        sort_order: 4,
        title: "PORTFOLIO",
        subtitle: "Brand Kit",
        active: true,
      },
    ],
  },
  {
    // Category: UI/UX & Motion Design
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "UUDP-001",
    title: "UI/UX Design Pro",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "UI/UX Design Pro",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "UX RESEARCH",
        subtitle: "Personas",
        active: true,
      },
      {
        sort_order: 2,
        title: "WIREFRAMES",
        subtitle: "Figma",
        active: true,
      },
      {
        sort_order: 3,
        title: "UI DESIGN",
        subtitle: "Figma, Prototyping",
        active: true,
      },
      {
        sort_order: 4,
        title: "TESTING",
        subtitle: "User Testing",
        active: true,
      },
    ],
  },
  {
    // Category: UI/UX & Motion Design
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "VEMG-001",
    title: "Video Editing & Motion Graphics",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Video Editing & Motion Graphics",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "VIDEO EDITING",
        subtitle: "Premiere Pro",
        active: true,
      },
      {
        sort_order: 2,
        title: "MOTION GRAPHICS",
        subtitle: "After Effects",
        active: true,
      },
      {
        sort_order: 3,
        title: "AUDIO & COLOR",
        subtitle: "Grading, Mixing",
        active: true,
      },
      {
        sort_order: 4,
        title: "SOCIAL VIDEO",
        subtitle: "Reels, Shorts",
        active: true,
      },
    ],
  },
  {
    // Category: Networking & Cybersecurity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "NEC-001",
    title: "Network Engineering with CCNA",
    duration: "12 Weeks",
    active: true,
    certificateTitle: "Network Engineering with CCNA",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "NETWORKING",
        subtitle: "OSI, IP",
        active: true,
      },
      {
        sort_order: 2,
        title: "ROUTING",
        subtitle: "Cisco Switches",
        active: true,
      },
      {
        sort_order: 3,
        title: "SECURITY",
        subtitle: "Firewalls",
        active: true,
      },
      {
        sort_order: 4,
        title: "CCNA PREP",
        subtitle: "Exam Labs",
        active: true,
      },
    ],
  },
  {
    // Category: Networking & Cybersecurity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "EHCS-001",
    title: "Ethical Hacking & Cyber Security",
    duration: "12 Weeks",
    active: true,
    certificateTitle: "Ethical Hacking & Cyber Security",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "SECURITY BASICS",
        subtitle: "Threats",
        active: true,
      },
      {
        sort_order: 2,
        title: "PEN TESTING",
        subtitle: "Kali Linux",
        active: true,
      },
      {
        sort_order: 3,
        title: "DEFENSE",
        subtitle: "Firewalls, IDS",
        active: true,
      },
      {
        sort_order: 4,
        title: "LABS",
        subtitle: "Real Simulations",
        active: true,
      },
    ],
  },
  {
    // Category: Networking & Cybersecurity
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "CSPC-001",
    title: "Cyber Security Professional (CEH/SOC Track)",
    duration: "16 Weeks",
    active: true,
    certificateTitle: "Cyber Security Professional (CEH/SOC Track)",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "CEH",
        subtitle: "Ethical Hacking",
        active: true,
      },
      {
        sort_order: 2,
        title: "SOC",
        subtitle: "Security Ops",
        active: true,
      },
      {
        sort_order: 3,
        title: "THREAT INTEL",
        subtitle: "Incident Response",
        active: true,
      },
      {
        sort_order: 4,
        title: "SIMULATION",
        subtitle: "SOC Capstone",
        active: true,
      },
    ],
  },
  {
    // Category: Digital Marketing & Freelancing
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "DMP-001",
    title: "Digital Marketing Pro",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Digital Marketing Pro",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "SEO",
        subtitle: "Search Ranking",
        active: true,
      },
      {
        sort_order: 2,
        title: "SOCIAL ADS",
        subtitle: "Meta, Google Ads",
        active: true,
      },
      {
        sort_order: 3,
        title: "CONTENT",
        subtitle: "Strategy",
        active: true,
      },
      {
        sort_order: 4,
        title: "ANALYTICS",
        subtitle: "Reporting",
        active: true,
      },
    ],
  },
  {
    // Category: Digital Marketing & Freelancing
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "AGMA-001",
    title: "Advanced Growth Marketing & Automation",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Advanced Growth Marketing & Automation",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "GROWTH",
        subtitle: "Funnels",
        active: true,
      },
      {
        sort_order: 2,
        title: "AUTOMATION",
        subtitle: "Email, CRM",
        active: true,
      },
      {
        sort_order: 3,
        title: "PAID ADS",
        subtitle: "Scaling",
        active: true,
      },
      {
        sort_order: 4,
        title: "ANALYTICS",
        subtitle: "Growth Metrics",
        active: true,
      },
    ],
  },
  {
    // Category: Digital Marketing & Freelancing
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "FOE-001",
    title: "Freelancing & Online Earning",
    duration: "4 Weeks",
    active: true,
    certificateTitle: "Freelancing & Online Earning",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "PLATFORMS",
        subtitle: "Upwork, Fiverr",
        active: true,
      },
      {
        sort_order: 2,
        title: "PORTFOLIO",
        subtitle: "Proposals",
        active: true,
      },
      {
        sort_order: 3,
        title: "CLIENTS",
        subtitle: "Communication",
        active: true,
      },
      {
        sort_order: 4,
        title: "PAYMENTS",
        subtitle: "Pricing",
        active: true,
      },
    ],
  },
  {
    // Category: Professional & Career Diplomas
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "ADP-001",
    title: "AutoCAD Design Professional",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "AutoCAD Design Professional",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "AUTOCAD 2D",
        subtitle: "Drafting",
        active: true,
      },
      {
        sort_order: 2,
        title: "3D MODELING",
        subtitle: "Solid Works",
        active: true,
      },
      {
        sort_order: 3,
        title: "DRAWINGS",
        subtitle: "Engineering Std",
        active: true,
      },
      {
        sort_order: 4,
        title: "PROJECTS",
        subtitle: "CAD Portfolio",
        active: true,
      },
    ],
  },
  {
    // Category: Professional & Career Diplomas
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "KCR-001",
    title: "Kids Coding & Robotics",
    duration: "8 Weeks",
    active: true,
    certificateTitle: "Kids Coding & Robotics",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "CODING BASICS",
        subtitle: "Scratch",
        active: true,
      },
      {
        sort_order: 2,
        title: "PROJECTS",
        subtitle: "Games, Apps",
        active: true,
      },
      {
        sort_order: 3,
        title: "ROBOTICS",
        subtitle: "Arduino",
        active: true,
      },
      {
        sort_order: 4,
        title: "SHOWCASE",
        subtitle: "Final Demo",
        active: true,
      },
    ],
  },
  {
    // Category: Professional & Career Diplomas
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "PCD-001",
    title: "Professional Computer Diploma",
    duration: "24 Weeks",
    active: true,
    certificateTitle: "Professional Computer Diploma",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "COMPUTER BASICS",
        subtitle: "Typing",
        active: true,
      },
      {
        sort_order: 2,
        title: "MS OFFICE",
        subtitle: "Word, Excel, PPT",
        active: true,
      },
      {
        sort_order: 3,
        title: "INTERNET & AI",
        subtitle: "Email, ChatGPT",
        active: true,
      },
      {
        sort_order: 4,
        title: "DESIGN BASICS",
        subtitle: "Photoshop, Canva",
        active: true,
      },
    ],
  },
  {
    // Category: Professional & Career Diplomas
    // Source: DarbarTech_Certificate_Course_Catalog_v2_ShortLabels.md
    code: "PAP-001",
    title: "Professional Accounting Package",
    duration: "10 Weeks",
    active: true,
    certificateTitle: "Professional Accounting Package",
    certificateTemplateId: "darbartech-certificate",
    certificateTemplateVersion: "2.0.0",
    providerName: "DarbarTech Group of Technology",
    // TODO: replace with an approved completion statement for this course.
    completionStatement:
      "has successfully completed all prescribed modules of this program.",
    modules: [
      {
        sort_order: 1,
        title: "ACCOUNTING",
        subtitle: "Bookkeeping",
        active: true,
      },
      {
        sort_order: 2,
        title: "TALLY",
        subtitle: "Busy Software",
        active: true,
      },
      {
        sort_order: 3,
        title: "GST",
        subtitle: "Taxation",
        active: true,
      },
      {
        sort_order: 4,
        title: "REPORTING",
        subtitle: "Financial Statements",
        active: true,
      },
    ],
  },
];

/**
 * Single entry point every seeding path (Supabase or in-memory) reads from.
 * Swap the body of this function for a real fetch to DarbarTech's canonical
 * course API once one exists/is reachable — callers don't need to change.
 */
export async function loadCanonicalCourseCatalog(): Promise<CourseCatalogSeed[]> {
  return CANONICAL_COURSE_CATALOG;
}

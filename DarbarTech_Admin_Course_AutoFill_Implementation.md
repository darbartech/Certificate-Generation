# DarbarTech Certificate Admin --- Course Auto-Fill & Catalog Synchronization Implementation Prompt

## 1. Objective

Upgrade the certificate admin workflow so that selecting a course
automatically fills all certificate information that belongs to that
course.

The public course reference supplied for this requirement is:

`https://darbarcomputer.vercel.app/courses`

The current project already contains:

-   `CourseRecord`
-   `CourseModuleRecord`
-   `/api/admin/courses`
-   `apiClient.listCourses()`
-   a `Quick-fill from course` selector
-   `handleCourseSelect()`
-   automatic population of program title, duration and modules

However, the current implementation is only partially correct because
the admin data is backed by the certificate project's own database/seed
data and is not guaranteed to be the same catalog represented by the
public `/courses` page.

The implementation must establish **one canonical course data source**
and make both the public course catalog and certificate admin workflow
use it.

## 2. Required behavior

When the administrator chooses:

``` text
Course → Select course
```

the following should automatically populate:

### Program

-   course ID
-   course code
-   course title
-   certificate/program title
-   duration

### Modules

For every module:

-   order
-   module title
-   module subtitle/description

### Certificate defaults

Where the course model supports them:

-   certificate template ID/version
-   required module count
-   provider/training organization
-   completion statement
-   grade availability
-   default signatories
-   course category
-   active/inactive state

The administrator should not need to manually retype course information
that already exists in the catalog.

## 3. Source-of-truth architecture

Do **not** scrape the rendered HTML of:

`https://darbarcomputer.vercel.app/courses`

The supplied public page is dynamically rendered and the current fetch
exposes only the loading shell rather than the complete catalog.

Instead, identify the data/API/service used by the public course page.

The desired architecture is:

``` text
                 ┌─────────────────────┐
                 │ Canonical Course DB  │
                 │ / course service     │
                 └──────────┬──────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
       Public /courses            Admin certificate
       course catalog             course selector
                │                       │
                └───────────┬───────────┘
                            ▼
                    Same course record
```

There must not be two independently maintained lists.

## 4. Preferred data model

Extend the existing course model only where necessary.

Recommended:

``` ts
type CourseRecord = {
  id: string;
  code: string;
  title: string;
  duration: string;
  active: boolean;

  certificateTitle?: string;
  certificateTemplateId?: string;
  certificateTemplateVersion?: string;

  providerName?: string;
  completionStatement?: string;

  modules: CourseModuleRecord[];
};

type CourseModuleRecord = {
  id: string;
  courseId: string;
  sortOrder: number;
  title: string;
  subtitle?: string;
  active: boolean;
};
```

If these values already exist elsewhere in the public website, reuse
them instead of duplicating them.

## 5. Current project behavior that must be preserved

The existing admin page already does this:

``` ts
const handleCourseSelect = (courseId: string) => {
  const course = courses.find((c) => c.id === courseId);

  setFormData((prev) => ({
    ...prev,
    program: {
      id: course.id,
      title: course.title,
      duration: course.duration,
      code: course.code,
    },
    modules: course.modules.map((m) => ({
      order: m.sort_order,
      title: m.title,
      subtitle: m.subtitle || "",
    })),
  }));
};
```

Do not remove this functionality.

Refactor it so it consumes the canonical catalog.

## 6. Admin UI requirements

Replace the current small `Quick-fill from course` control with a more
explicit workflow.

Recommended:

### Course Selection

``` text
Course
[ Select course ▼ ]

Course Code: PCDSP-001
Program: Professional Computer & Digital Skills Program
Duration: 4 Months
Modules: 4
```

After selection, show a read-only confirmation summary.

Then:

``` text
[✓ Course data loaded]
```

The administrator may edit recipient-specific fields, but course-owned
fields should not be casually overwritten.

## 7. Course-owned vs certificate-owned fields

### Course-owned --- auto-filled

-   course ID
-   course code
-   program/course title
-   duration
-   modules
-   module order
-   module titles
-   module subtitles
-   template mapping
-   provider name, if defined
-   completion statement, if defined

### Certificate-owned --- entered per student

-   recipient name
-   student ID
-   grade
-   completion date
-   issue date
-   certificate number, if manual
-   verification token
-   recipient-specific notes, if supported

### Organization-owned

-   authorized signatories
-   logo
-   contact details
-   verification domain
-   default footer
-   brand colors
-   certificate template definitions

Do not mix these responsibilities.

## 8. Prevent accidental stale data

A common bug in the current workflow is:

``` text
Admin selects Course A
↓
Modules populated

Admin selects Course B
↓
Some old fields remain
```

On every course change, replace the entire course-owned state.

Do not merge old modules with new modules.

Required behavior:

``` ts
selectCourse(course) {
  setProgram({
    id: course.id,
    code: course.code,
    title: course.certificateTitle ?? course.title,
    duration: course.duration,
  });

  setModules(
    course.modules
      .filter(m => m.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(...)
  );
}
```

## 9. Exact four-module certificate requirement

The supplied original certificate is a four-column design.

For the production exact-match certificate template:

``` text
Module 01 | Module 02 | Module 03 | Module 04
```

is the standard layout.

Therefore, after selecting a course:

-   if it contains exactly 4 active modules → allow exact-match template
-   if it contains fewer/more → show a clear template compatibility
    warning
-   do not silently squeeze arbitrary module counts into the four-column
    design

Example:

``` text
Template compatibility
✓ This course contains 4 modules and matches the certificate layout.
```

or:

``` text
Template compatibility
⚠ This course contains 5 modules.
The current certificate design supports exactly 4 modules.
Choose an approved alternate template or update the course structure.
```

Do not allow an administrator to issue a visibly broken certificate.

## 10. Data validation

Add server-side validation.

Required:

-   course exists
-   course is active
-   course ID matches selected course
-   modules belong to that course
-   modules are active
-   module order is unique
-   module count is valid for the selected template
-   course title is not empty
-   duration is not empty
-   module titles are not empty

Do not trust module data posted by the browser.

At preview/issue time, reload the canonical course record server-side
and verify the submitted course data.

## 11. Snapshotting

Once a certificate is issued, preserve the course data used at issuance.

Do not make an issued certificate change when an administrator later
edits a course.

The issued certificate's `data_snapshot` should contain:

``` json
{
  "program": {
    "id": "...",
    "code": "...",
    "title": "...",
    "duration": "..."
  },
  "modules": [
    {
      "order": 1,
      "title": "...",
      "subtitle": "..."
    }
  ]
}
```

This is important for auditability and reissue behavior.

## 12. Reissue behavior

When a certificate is reissued:

1.  load the original certificate snapshot
2.  load the current course only when the administrator explicitly
    chooses to refresh course data
3.  otherwise preserve the original snapshot
4.  record what changed

Never silently replace historical module data.

## 13. API design

Keep the existing protected endpoint:

``` text
GET /api/admin/courses
```

but make it return canonical course data.

Recommended response:

``` json
{
  "success": true,
  "data": [
    {
      "id": "course-id",
      "code": "PCDSP-001",
      "title": "Professional Computer & Digital Skills Program",
      "certificateTitle": "Professional Computer & Digital Skills Program",
      "duration": "4 Months",
      "active": true,
      "certificateTemplateId": "darbartech-certificate",
      "certificateTemplateVersion": "2.0.0",
      "modules": [
        {
          "id": "m1",
          "sortOrder": 1,
          "title": "COMPUTER FUNDAMENTALS",
          "subtitle": "Basic Computer Operations",
          "active": true
        }
      ]
    }
  ]
}
```

## 14. Do not scrape the public web page from the browser

Do not implement:

``` ts
fetch("https://darbarcomputer.vercel.app/courses")
```

inside the admin React component and parse HTML.

Problems:

-   dynamic rendering
-   brittle HTML structure
-   CORS
-   slow UX
-   public page changes can break admin
-   difficult validation
-   no reliable historical snapshot

Instead, identify/reuse the underlying course data source.

If the public site currently has no reusable API, create one canonical
course service/API and make both pages consume it.

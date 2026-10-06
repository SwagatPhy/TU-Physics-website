# Portal — User-Facing & Admin Copy

## PRIORITY 1: Faculty Dashboard Form

### Section Title
"Manage Class Links"

### Intro
"Add and manage links for your courses. Reminder: class and notes links can be shared, so restrict Google Drive and Meet access to specific people."

### Course Display
- With students: "Students enrolled"
- Without students: "No students enrolled yet."
- Without links: "No links yet."

### Form Fields

**Type dropdown label:** "Link type"
- Class link
- Notes
- Other

**Title field label:** "Link title"
**Help text:** (none)

**URL field label:** "URL"
**Help text:** "Must start with https:// or http://"

**Date field label:** "Show to students from"
**Help text:** "Optional; leave blank to show straight away"

**Hidden note:** "Hidden from students until this date"

### Form Actions
- "Add link"
- "Save changes"
- "Cancel"
- "Edit" (per link)
- "Delete" (per link)

### Delete Confirmation
"Remove this link?"

### Success Messages
- "Link added."
- "Changes saved."
- "Link deleted."

### Error Messages (Faculty Dashboard)
- `invalid_title`: "Please enter a link title."
- `invalid_url`: "Please enter a valid web address (https:// or http://)."
- `invalid_date`: "Please enter a valid date."
- `course_not_found`: "Course not found."
- `resource_not_found`: "Link not found."
- `not_allowed`: "You don't have permission for this."

---

## PRIORITY 2: Notes Section (NEW)

### Section Headings
- **"Class links"** — for course materials
- **"Notes"** — for study notes

### Form Fields (Notes)

**Note title field label:** "Note title"

**Upload field label:** "Upload a file (PDF, Word, PowerPoint, or text; up to 20 MB)"
**Supported formats:** .pdf .txt .md .csv .docx .pptx (macro-enabled and old formats not supported)

**Optional Link field label:** "An article or reference (optional)"

### Validation
**Required:** "A note needs a file or a link"

### Form Actions (Notes)
- "Add note"
- "Save changes"
- "Cancel"
- "Edit" (per note)
- "Delete" (per note)

### Status Messages (Notes)
**While uploading:** "Uploading the file…"

### Success Messages (Notes)
- "Note added."
- "Note deleted."
- "Changes saved." (reused for edits)

### Delete Confirmation (Notes)
"Delete this note?"

### Editing a Note
**When a file is attached:** "Current file: [filename]"

### Error Messages (Notes)
- `invalid_file_type`: "File type not supported. Allowed formats: PDF, Word (.docx), PowerPoint (.pptx), text (.txt, .md, .csv). Macro-enabled and old .doc/.ppt files are not accepted."
- `file_too_large`: "File is too large. Maximum size is 20 MB."
- `invalid_file`: "The file could not be read. Try uploading it again."
- `noCourses`: "You have no courses assigned yet. Contact [PLACEHOLDER: department office] to get started."

### Student View
- **Download button label:** "Download"
- **Empty state (no notes):** "No notes yet."
- **Empty state (no class links):** "No class links yet."
- Link display: title + download icon (or external-link icon if URL only)

### Notes Section Confirmation
- Replace: "Replace this file?"
- Delete: "Delete this note?"

### Students Enrolled Confirmation
**"Students enrolled:" is followed by the number.** ✓ (OK as-is)

---

## PRIORITY 3: Sign-Up, Pending, Approvals & Emails

### Sign-Up Page

**Title:** "Create your account"

**Intro:** "Welcome to the Department of Physics portal. Sign up and we'll approve your account."

**Role selector:** "I am a..."
- "Student"
- "Faculty, research scholar or staff member"

**Fields:**
- Full name: "Full name"
- Email: "Email address"
- Roll number: "Roll number (format: [PLACEHOLDER: e.g. PHD22017])"
- Contact number: "Phone number (format: [PLACEHOLDER]; department use only)"

**Button:** "Sign up"

**After email confirmation:**
"Email confirmed. Now choose your password."

**After password set (pending):**
"Account created! The department will review your sign-up and email you once approved."

**After password set (auto-approved):**
"Account created and approved. You can now log in."

### Waiting for Approval Message

**Heading:** "Your sign-up is pending"

**Message:** "We're reviewing your request. You'll receive an email once approved."

### Admin Approvals Page

**Title:** "Approve Sign-Ups"

**Intro:** "Review and approve pending accounts. You can edit name, roll number and contact number before approving."

**Empty state:** "No sign-ups waiting for approval."

**Table columns:**
- Name
- Roll number
- Programme
- Email
- Contact number
- Type (Student / Department member)
- Signed up on
- Actions

**Buttons:**
- "Select all"
- "Approve selected"
- "Reject selected"

**Confirmations:**
- "Reject [N] sign-up(s)?"

**Success messages:**
- "Details saved."
- "Approved: [N] account(s)."
- "Rejected: [N] account(s)."

**Errors:**
- "Select at least one first."
- "This page is for administrators."

**Link:** "Manage course links" (to faculty dashboard)

### Error Messages (Sign-Up & General)

| Code | Message |
|------|---------|
| `invalid_name` | "Please enter a valid name." |
| `invalid_email` | "Please enter a valid email address." |
| `invalid_phone` | "Please enter a valid phone number." |
| `invalid_roll_number` | "Please enter a valid roll number." |
| `approval_pending` | "Your account is waiting for approval. Check your email for updates." |
| `roll_number_taken` | "This roll number is already registered." |
| `user_not_found` | "No account found with that email." |
| `invalid_kind` | "Please select a valid account type." |

### Email Templates

**Email 1: Account already exists**

Subject: "Portal account already exists"

Body:
```
Hello {name},

An account with this email already exists.

Log in here: [LOGIN LINK]
Reset password: [RESET LINK]

If you didn't create this account, contact [PLACEHOLDER: department office].

Best regards,
Department of Physics
[PLACEHOLDER: Contact]
```

**Email 2: Sign-up incomplete (roll number in use)**

Subject: "We couldn't complete your sign-up"

Body:
```
Hello {name},

We couldn't create your account. Your roll number may already be registered.

Please contact [PLACEHOLDER: department office] for help.

Best regards,
Department of Physics
[PLACEHOLDER: Contact]
```

**Email 3: Account approved**

Subject: "Your portal account is approved"

Body:
```
Hello {name},

Your account has been approved! Log in here:

[LOGIN LINK]

Best regards,
Department of Physics
[PLACEHOLDER: Contact]
```

**Email 4: Sign-up rejected**

Subject: "About your portal sign-up"

Body:
```
Hello {name},

Your sign-up was not approved at this time.

Contact [PLACEHOLDER: department office] if you have questions.

Best regards,
Department of Physics
[PLACEHOLDER: Contact]
```

---

## PRIORITY 4: Privacy Notice

### Short Privacy Notice (Footer or Policy Page)

"The Department of Physics portal stores your name, email, phone number, and roll number (if applicable) to manage course enrollment and communications. We do not share your information with third parties. You can request deletion of your account at any time by contacting [PLACEHOLDER: department office]."

---

*All [PLACEHOLDER] values to be filled by department. Links are developer trial only (@trial.test); production links will be configured at deployment.*

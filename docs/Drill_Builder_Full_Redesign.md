Drill Builder --- Full Redesign Change Spec & Technical Reference ---
Updated July 3, 2026 This document describes the changes to the existing
Drill Builder. The existing AI generation modal, drill builder form,
chatbot sidebar, and Excel fallback all stay. What changes is the entry
point, the navigation structure, and how drills are generated and
uploaded. Backend changes marked with ✅ are already built and merged.
UI changes are pending.

1.  Drill Builder Page --- New Entry Point The Drill Builder page
    currently shows a list of all drills. This is replaced with a
    student list --- the same one already built in the AI User Builder
    page. The AI User Builder nav item is removed. The Drill Builder nav
    item now leads to this student list. The page title changes to
    'Drill Builder'. What is removed The 'All Drills' tab and list The
    'Free Talk Scenarios' tab from this page The 'AI User Builder' nav
    item --- merged into Drill Builder Routes /admin/drills --- now
    shows the student list /tutor/drills --- same Data source GET
    /api/v1/tutor/students --- for tutors GET /api/v1/users?role=learner
    --- for admins

2.  Student Page --- Weekly Work View This page already exists in the AI
    User Builder. One fix needed: if the tutor opens a student page and
    no context has been set up yet, the context form must appear before
    the weekly work view. Currently this is not happening. Fix ---
    frontend only On page load, call GET
    /api/v1/students/\[studentId\]/context ✅ (endpoint works) If 404
    returned → show context form If 200 returned → show weekly work view
    Note on weekly work data GET /api/v1/students/\[studentId\]/weeks ✅
    returns an items array per week, not drills StudentWeekData type has
    been updated to include items field ✅ Each item has a type field:
    'drill_assignment' or 'weekly_challenge'

3.  Week Detail Page --- Changes This page already exists. Two changes:
    Create Drill button now opens the updated AI generation modal that
    supports multiple drill types A 'Create Drill Manually' button is
    added --- opens the existing drill builder form with no AI

4.  AI Generation Form --- Changes The existing Generate Drill with AI
    modal stays with these changes: Removed Completion Date field ---
    removed. Each drill has a different date, set individually after
    generation. New field --- Drill Types (multi-select) ✅ backend
    ready A dropdown with checkboxes for all 10 drill types Tutor
    selects which types to generate for this week At least one must be
    selected On submit POST /api/v1/drills/ai-generate ✅ now accepts
    drillTypes: string\[\] (array) Backward compatible --- single
    drillType string is coerced to array Generates all selected types in
    parallel Fetches prompt template per drillType + topic + mission
    from DB Student context and weakness profile injected per generation
    Returns: \[{ drillType, content }, { drillType, content }, ...\]

5.  Generated Content Preview --- Changes Currently shows one drill
    type. Now shows all generated drill types at once in one scrollable
    view. Each drill type is a clearly labelled section
    (e.g. 'Vocabulary --- 20 items', 'Pronunciation --- 12 items'). The
    Refine with AI sidebar works the same way. The tutor specifies which
    drill type they want changed and the AI updates only that one.
    Export as Excel --- exports all drill types 'Use This Drill' button
    renamed to 'Use These Drills' --- populates all drill builder forms
    at once

6.  Drill Builder Forms --- Prev/Next Navigation After clicking Use
    These Drills, one drill builder form appears per generated drill
    type. The tutor navigates between them with Previous and Next
    buttons. A progress indicator shows position (e.g. '2 of 5'). Each
    form is the existing drill builder form pre-filled with AI content.
    The tutor can edit any field manually. Completion Date is required
    on each form but left empty for the tutor to fill in manually.
    Upload button Disabled until all completion dates are filled Warning
    shown listing which drills are missing a date if tutor clicks early
    On upload: POST /api/v1/drills/bulk-create-assign ✅ On success:
    navigate back to week detail page Draft saving and editing Whatever
    the dev already has in place stays unchanged

7.  Backend Status ✅ Already built and merged POST
    /api/v1/drills/ai-generate --- accepts drillTypes\[\], returns array
    of results POST /api/v1/drills/bulk-create-assign --- creates and
    assigns multiple drills at once GET/POST
    /api/v1/students/\[studentId\]/context GET
    /api/v1/students/\[studentId\]/weeks --- returns items array with
    drill_assignment and weekly_challenge types GET/POST
    /api/v1/prompt-templates + PUT /api/v1/prompt-templates/\[id\]
    StudentWeekData type updated to include items field StudentListPage
    and WeekDetailPage type predicate errors fixed Unchanged endpoints
    POST /api/v1/drills/ai-chat All existing drill CRUD endpoints GET
    /api/v1/tutor/students

8.  What Does NOT Change Existing drill builder form components ---
    reused as-is AI chat sidebar --- reused as-is Export as Excel
    functionality Manual drill creation flow Excel import fallback Draft
    saving and drill editing Student context form UI --- already built
    Weekly work view --- already built

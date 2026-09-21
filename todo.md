First, please inspect the existing submission, admin panel, reviewer panel, and user portal implementation. Do not assume or recreate anything that already exists.

I need the paper submission workflow to work like this:

When a user submits a paper, it should first appear in the Admin Panel → Submissions. From there, it should also be available in the Reviewer Panel for review.

If the reviewer accepts a paper, the status should become “Accepted - Ready for Registration”. This same status should be shown both in the Admin Panel and in the respective User Portal.

Important: Once a paper is accepted and its status is “Accepted - Ready for Registration”, any later file edit by that user should NOT send the paper back to the reviewer or change its accepted status. It must remain “Accepted - Ready for Registration” for that particular accepted submission.

For papers that require changes, I want more specific statuses instead of simply showing “Under Review”.

The Admin Panel should show:

* Accepted with Minor Changes
* Accepted with Major Changes
* Not Accepted

These statuses should also have different clear colors so the admin/reviewer can understand them quickly.

In the User Portal, the respective user should also see the same status, such as:

* Accepted with Minor Changes
* Accepted with Major Changes
* Not Accepted

For papers marked as Minor Changes or Major Changes, the paper should remain inside the Need Revisions section.

When the author updates/re-uploads the revised paper, I do NOT want to move it back to the Main Submissions section. It can remain inside Need Revisions, but the system must clearly highlight that the author has submitted an updated version.

For example, when a revised file is uploaded, show a clear visual indication such as:

* blinking border
* highlighted row
* “Updated” badge
* priority indicator
* or another clean visual notification

The purpose is to make it immediately obvious to the reviewer/admin that:

“This paper was recently updated by the author and is ready for re-review.”

The reviewer should then be able to open that submission directly from the Need Revisions section, review the latest uploaded file, and update the status again.

Please make sure the latest uploaded file/version is always clearly available to the reviewer.

Also, please preserve the existing UI and functionality wherever possible. Before making changes, inspect the current codebase and understand how the existing submission statuses, admin panel, reviewer panel, user portal, and file upload/version handling are currently implemented.

Do not unnecessarily create duplicate workflows or duplicate submission entries.

The main goal is to make the paper review workflow simple:

New Submission → Review → Accepted / Minor Changes / Major Changes / Not Accepted

For revision cases:

Minor/Major Changes → Author Updates Paper → Same Need Revisions Section → Clearly Highlight as Recently Updated → Reviewer Re-Reviews → New Status

For accepted papers:

Accepted → Ready for Registration → Even if the author edits/uploads a file later, keep the accepted status and do not send it back for review.
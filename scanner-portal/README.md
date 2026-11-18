# ICAIDIET Attendance Scanner

Phone web app used at the ICAIDIET'26 registration desk. No sign-in.
Backend: `backend/src/attendance.ts` + migration `0043_paper_attendance.sql`.

## How it works

- **One QR per paper.** Every offline-attending paper (plus paper 1271) has a QR
  token generated and stored by the backend (`paper_attendance_qr`). Every author
  of the paper who signs in to the user portal sees the same QR in My Submissions,
  above the Phase 2 card, under "Show this QR to mark your attendance".
- **Only this scanner reads it.** The QR is `ICD26.<token>.<HMAC signature>`; the
  signing key never leaves the Worker, so QRs cannot be forged and any other QR is
  rejected.
- **Campus only.** The phone's GPS must be within the radius of SNS College of
  Technology, Coimbatore (centre 11.09991, 77.02656, radius 700 m). Outside it the
  scanner shows "This geolocation is not accessible". The server checks the
  location again on every scan and every mark.
- **Marking.** After a verified scan the phone vibrates and shows the paper title,
  each author (title, first and last name) with Present / Absent buttons, the
  College / Industry name, the head count from the camera-ready form (read only)
  and the presented count. "Mark attendance" stores it in `paper_attendance`.
  A paper can be marked once; the author's QR is then replaced by the thank-you
  note.

## Deploy

1. Optional, before authors see QRs: `npx wrangler secret put QR_SIGNING_SECRET`
   (changing it later invalidates every QR).
2. From `backend/`: `npx wrangler d1 migrations apply icaidiet_text_records --remote`
   then `npm run deploy`. Make sure the scanner URL is in `ALLOWED_ORIGINS`.
3. Deploy `scanner-portal` on Vercel with `VITE_API_URL` = the Worker URL
   (HTTPS is required for camera and GPS). Redeploy `user-portal`.

## Admin endpoints (admin token)

- `GET /api/admin/attendance` – every eligible paper with its status and roster
- `GET /api/admin/attendance/export` – Excel report
- `POST /api/admin/attendance/:submissionId/reset` – undo a mistaken mark
- `GET|POST /api/admin/attendance/config` – adjust venue centre / radius / pause

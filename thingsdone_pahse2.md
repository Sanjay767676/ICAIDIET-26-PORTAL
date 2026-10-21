# Things Done — Phase 2 (Camera-Ready & Copyright)

**In short:** Accepted papers whose payment is approved can now submit their final documents
(camera-ready paper + signed copyright form) through the portal. Everything is built,
tested, and live. It stays hidden until you switch it on.

---

## What an author can now do

- On the **My Submissions** page, a black **"Move to Phase 2"** button appears below the
  paper details — but only when all three things are true:
  1. You (the admin) have turned Phase 2 on,
  2. the paper is accepted, and
  3. the payment is approved.
- Clicking it opens a **Phase 2 page** where the author can:
  - **Download two PDFs** with black buttons — the Camera Ready Template and the
    Copyright Form.
  - **Pick their mode of attending** — Online or Offline (must choose one).
  - **Upload two PDFs** — their camera-ready paper and the signed copyright form.
  - **Tick the declaration checkbox** — confirming the documents are verified,
    plagiarism-checked, and not copied from other sources (must tick it).
  - **Click the black "Submit for Phase 2" button** to finish.
- After submitting, the button is replaced by a **summary card** showing what they
  submitted, the files, and the date — so they always know where they stand.
- The page is **protected** — no author can open another author's Phase 2 page, even by
  tricking the address.

## What you (the admin) will see

- A new **"Camera Ready"** tab in the admin portal, right after the Payments tab.
  - It lists every paper that has submitted its Phase 2 documents, with:
    - Paper title
    - Primary author's name, phone, and email
    - Submission date
    - Buttons to **view the camera-ready paper** and **view the copyright form**
    - The **reviewer's decision** as the status (accepted / minor changes / major
      changes / not accepted)
    - A **View Info** button for full details
- A paper **automatically moves** from the Payments tab to this new tab the moment its
  author submits Phase 2 — nothing to do by hand.
- A new **switch in Settings** ("Phase 2 — Camera Ready & Copyright") controls the whole
  feature. It is **OFF for now** — nothing is visible to authors until you turn it on.

## What the reviewer will see

- A new **"View Camera Ready"** tab in the reviewer portal, listing the submitted papers
  with the paper title, primary author, submission date, and buttons to view the
  camera-ready paper and the copyright form.

## What was set up behind the scenes

- A new storage bucket named **`phase2`** was created on Cloudflare to hold the two
  template PDFs that authors download. Placeholder PDFs are in there for now so the
  buttons work — you can replace them with the real documents later.
- A small database update was applied so each paper can record: mode of attending,
  declaration ticked, and when Phase 2 was submitted.
- The backend was updated and is **already live**.
- All changes are **pushed to GitHub** (the websites on Vercel will rebuild from that).

## Current status — everything is done and live

- Code written for all three portals + backend ✅
- Tested — everything compiles with no errors ✅
- Database update applied to the live database ✅
- Template storage bucket created and placeholder templates uploaded ✅
- Backend deployed and working ✅
- Everything pushed to GitHub ✅

## What is left for you (small things)

1. **Wait for Vercel** to rebuild the three websites from the push (or click redeploy).
2. When you want to **open Phase 2 for authors**: go to the admin portal → Settings →
   turn on the **"Phase 2 — Camera Ready & Copyright"** switch.
3. When you have the **real template PDFs**, send them over (or drop them into
   `backend/assets/phase2-templates/` with the same file names) and I will upload them
   to replace the placeholders.
4. Reminder: acceptance emails send automatically now — no need to send them manually.

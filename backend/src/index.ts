import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'OpenConf Cloudflare API',
    timestamp: new Date().toISOString()
  });
});

// Create Submission (with File Upload to R2 and DB Insert to D1)
app.post('/api/submissions', async (c) => {
  try {
    const formData = await c.req.parseBody();
    
    const paperId = formData['paperId'] as string || `SUB-${Date.now()}`;
    const title = formData['title'] as string;
    const abstract = formData['abstract'] as string;
    const track = formData['track'] as string;
    const file = formData['file'] as File;

    if (!title || !abstract || !track) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    let fileKey = null;
    let fileUrl = null;

    // 1. Upload to R2 if file exists
    if (file) {
      fileKey = `submissions/${paperId}-${file.name.replace(/\s+/g, '-')}`;
      await c.env.BUCKET.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type }
      });
      // Assuming a public or presigned URL could be generated
      fileUrl = `r2://${fileKey}`; 
    }

    // 2. Insert into D1
    const submissionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // In a full implementation, you'd insert the user, then submission, then submission_files
    // Using a simplified query for demonstration based on the schema
    await c.env.DB.prepare(`
      INSERT INTO submissions (id, submission_code, title, abstract, keywords, user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      submissionId, 
      paperId, 
      title, 
      abstract, 
      track, // Storing track as keyword for now
      'mock-user-id', // Mock user
      'SUBMITTED', 
      now, 
      now
    ).run();

    if (fileKey) {
      const fileId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO submission_files (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fileId,
        submissionId,
        'MANUSCRIPT',
        file.name,
        fileKey,
        file.type,
        file.size,
        now
      ).run();
    }

    return c.json({ 
      success: true, 
      message: 'Submission received successfully',
      submission_id: submissionId,
      paper_id: paperId
    });

  } catch (error) {
    console.error('Submission error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// Get all submissions for Admin Portal
app.get('/api/admin/submissions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT s.id, s.submission_code, s.title, s.keywords as track, s.status, s.created_at, u.name as author
      FROM submissions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `).all();

    return c.json({ submissions: results });
  } catch (error) {
    console.error('Fetch error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default app;

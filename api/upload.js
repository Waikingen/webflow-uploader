module.exports = async (req, res) => {
  // --- CORS ---
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // --- Kontroll av metod ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  try {
    const { Storage } = require('@google-cloud/storage');
    const crypto = require('crypto');

    // --- Ladda credentials från env ---
    const keyEnv = process.env.GCS_KEY;
    if (!keyEnv) {
      console.error('Missing GCS_KEY environment variable');
      return res.status(500).json({ error: 'Missing GCS_KEY in server config' });
    }

    const serviceAccount = JSON.parse(keyEnv);

    const storage = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key.replace(/\\n/g, '\n'), // fixa nyckeln!
      },
    });

    const BUCKET_NAME = 'wiking-portal';
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Missing filename or contentType' });
    }

    const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const gcsPath = `${fileId}-${filename}`;
    const file = storage.bucket(BUCKET_NAME).file(gcsPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000, // 10 min
      contentType,
    });

    return res.status(200).json({
      uploadUrl,
      publicId: gcsPath,
    });
  } catch (error) {
    console.error('Error in upload.js:', error);
    return res.status(500).json({
      error: 'Internal Server Error: Could not generate upload URL.',
      details: error.message,
    });
  }
};

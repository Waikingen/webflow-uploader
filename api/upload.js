module.exports = async (req, res) => {
  // CORS HEADER
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { Storage } = require('@google-cloud/storage');
  const crypto = require('crypto');

  const serviceAccount = JSON.parse(process.env.GCS_KEY);

  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });

  const BUCKET_NAME = 'wiking-portal';

  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  const { filename, contentType } = req.body;
  if (!filename || !contentType) return res.status(400).send('Missing fields');

  const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const file = storage.bucket(BUCKET_NAME).file(fileId + '-' + filename);

  const expiresAt = Date.now() + 10 * 60 * 1000;

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType,
  });

  return res.json({ uploadUrl: url, publicId: file.name });
};

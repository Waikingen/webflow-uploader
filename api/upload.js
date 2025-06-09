module.exports = async (req, res) => {
  // Hantera preflight först
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  // CORS HEADERS för övriga requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Importera dependencies
  const { Storage } = require('@google-cloud/storage');
  const crypto = require('crypto');

  // Hämta servicekonto-data från environment variabel
  const serviceAccount = JSON.parse(process.env.GCS_KEY);

  // Initiera GCS-klienten
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });

  const BUCKET_NAME = 'wiking-portal';

  // Kontrollera att det är POST
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  // Läs filnamn och typ från body
  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    return res.status(400).send('Missing fields');
  }

  // Skapa unikt fil-ID
  const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const file = storage.bucket(BUCKET_NAME).file(`${fileId}-${filename}`);

  // URL gäller i 10 minuter
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // Hämta signed URL
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType,
  });

  // Returnera till frontend
  return res.json({
    uploadUrl: url,
    publicId: file.name,
  });
};

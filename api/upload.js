module.exports = async (req, res) => {
  // --- START CORS HEADERS & PREFLIGHT HANDLING ---
  // Handle preflight (OPTIONS) request first
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Consider replacing '*' with your specific Webflow domain in production
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Added Authorization just in case you add it later
    res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight response for 24 hours
    return res.status(200).end();
  }

  // Set CORS HEADERS for all other requests (like POST)
  res.setHeader("Access-Control-Allow-Origin", "*"); // Consider replacing '*' with your specific Webflow domain in production
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Added Authorization just in case you add it later
  // --- END CORS HEADERS & PREFLIGHT HANDLING ---

  // --- YOUR EXISTING GCS SIGNED URL GENERATION LOGIC ---
  try {
    // Importera dependencies
    const { Storage } = require('@google-cloud/storage');
    const crypto = require('crypto');

    // Hämta servicekonto-data från environment variabel
    // Ensure GCS_KEY environment variable is properly set as a JSON string
    if (!process.env.GCS_KEY) {
      console.error('Environment variable GCS_KEY is not set.');
      return res.status(500).json({ error: 'Server configuration error: GCS_KEY missing.' });
    }
    const serviceAccount = JSON.parse(process.env.GCS_KEY);

    // Initiera GCS-klienten
    const storage = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key.replace(/\\n/g, '\n'), // Replace escaped newlines if present
      },
    });

    const BUCKET_NAME = 'wiking-portal'; // Your GCS bucket name

    // Kontrollera att det är POST
    if (req.method !== 'POST') {
      return res.status(405).send('Only POST allowed');
    }

    // Läs filnamn och typ från body
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).send('Missing "filename" or "contentType" in request body.');
    }

    // Skapa unikt fil-ID
    const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const gcsFileName = `${fileId}-${filename}`; // Use a unique name for GCS to avoid conflicts
    const file = storage.bucket(BUCKET_NAME).file(gcsFileName);

    // URL gäller i 10 minuter
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Hämta signed URL
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write', // Allows uploading
      expires: expiresAt,
      contentType: contentType, // Important for browser uploads
    });

    // Returnera till frontend
    return res.json({
      uploadUrl: url,
      publicId: gcsFileName, // Use the full GCS path/name as publicId for consistency
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    // Be more specific with error messages if possible, e.g., if JSON.parse fails
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return res.status(500).json({ error: 'Server configuration error: GCS_KEY is not valid JSON.' });
    }
    return res.status(500).json({ error: 'Internal Server Error: Could not generate upload URL.' });
  }
  // --- END YOUR EXISTING GCS SIGNED URL GENERATION LOGIC ---
};

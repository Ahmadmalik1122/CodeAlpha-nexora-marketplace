// Image upload via multer when installed; degrades gracefully otherwise.
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

let multer = null;
try { multer = require('multer'); } catch { /* optional */ }

let uploader = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `p_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    },
  });
  uploader = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only image files are allowed.'));
    },
  });
}

// Returns middleware for a single file field; no-op (skips) if multer absent.
function single(field) {
  if (uploader) return uploader.single(field);
  return (req, res, next) => next();
}

module.exports = { available: !!multer, single, uploadsDir };

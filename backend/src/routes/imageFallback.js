const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const IMAGES_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(__dirname, '../../../image-fallback/storage/images');

router.get('/:filename', (req, res) => {
  const requested = req.params.filename;
  if (!requested || /[\\/\u0000]/.test(requested)) {
    return res.status(400).end();
  }
  const filePath = path.join(IMAGES_DIR, requested);
  if (!filePath.startsWith(path.resolve(IMAGES_DIR))) {
    return res.status(403).end();
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(filePath);
});

module.exports = router;

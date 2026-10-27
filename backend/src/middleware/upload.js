const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (images only)
const fileFilter = (req, file, cb) => {
    console.log('Multer Filter:', file.originalname, file.mimetype);
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) && /\.(jpe?g|png|webp)$/i.test(file.originalname)) {
        cb(null, true);
    } else {
        console.error('Multer Rejected:', file.mimetype);
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        files: 1, fields: 10, parts: 11,
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = upload;

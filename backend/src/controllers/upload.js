const CloudinaryService = require('../services/cloudinary.service');
const { saveFile, getLocalBlurDataURL } = require('../utils/localImageStore');
const path = require('path');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { path: filePath, originalname } = req.file;
        console.log('📤 Starting upload for:', originalname);

        // 1. Save locally first
        const local = saveFile(filePath, originalname, null, { removeSource: false });
        console.log('💾 Local image saved:', local.localUrl);

        // 2. Try Cloudinary as fallback (so we keep a copy + public_id for migrations)
        let cloudinaryResult = null;
        try {
            cloudinaryResult = await CloudinaryService.uploadImage(filePath, 'balport-products');
            console.log('☁️ Cloudinary upload successful:', cloudinaryResult.url);
        } catch (cloudErr) {
            console.warn('Cloudinary upload failed, continuing with local only:', cloudErr.message);
        }

        // 3. Clean up the temporary multer file
        try {
            if (require('fs').existsSync(filePath)) require('fs').unlinkSync(filePath);
        } catch (err) {
            console.error('Failed to delete temp upload file:', err);
        }

        // 4. Return local URL as primary; Cloudinary URL as fallback
        const blurDataURL = cloudinaryResult?.blurDataURL || await getLocalBlurDataURL(local.filePath);

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: local.localUrl,
                public_id: cloudinaryResult?.public_id || local.filename,
                blurDataURL,
                fallbackUrl: cloudinaryResult?.url || null
            }
        });

    } catch (error) {
        console.error('Upload Controller Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

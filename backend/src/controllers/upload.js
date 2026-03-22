const CloudinaryService = require('../services/cloudinary.service');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        console.log('📤 Starting Cloudinary upload for:', req.file.originalname);

        // Upload to Cloudinary
        const result = await CloudinaryService.uploadImage(req.file.path, 'balport-products');

        console.log('✅ Cloudinary upload successful:', {
            url: result.url,
            public_id: result.public_id
        });

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: result.url,
                public_id: result.public_id,
                blurDataURL: result.blurDataURL
            }
        });

    } catch (error) {
        console.error('Upload Controller Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

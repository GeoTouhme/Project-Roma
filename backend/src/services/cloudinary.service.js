const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const getBlurDataURL = require('../config/getBlurDataURL');

class CloudinaryService {
    /**
     * Upload a file to Cloudinary
     * @param {string} filePath - Local path to the file
     * @param {string} folder - Cloudinary folder name (default: 'balport-products')
     * @returns {Promise<{url: string, public_id: string, blurDataURL: string}>}
     */
    async uploadImage(filePath, folder = 'balport-products') {
        try {
            if (!filePath) {
                throw new Error('No file path provided for upload');
            }

            const result = await cloudinary.uploader.upload(filePath, {
                folder: folder,
                resource_type: 'image',
            });

            // Generate blur placeholder
            // We can use the helper we already have, or generate it from Cloudinary low-quality transformation
            // For consistency with existing code, let's use the existing helper if possible, 
            // OR since we have the URL, we can fetch it. 
            // Actually, the existing getBlurDataURL fetches the image.
            const blurDataURL = await getBlurDataURL(result.secure_url);

            // Clean up local file
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error('Failed to delete local file after upload:', err);
            }

            return {
                url: result.secure_url,
                public_id: result.public_id,
                blurDataURL: blurDataURL,
            };
        } catch (error) {
            console.error('Cloudinary Upload Error:', error);
            throw new Error(`Image upload failed: ${error.message}`);
        }
    }

    /**
     * Delete a file from Cloudinary
     * @param {string} publicId - Cloudinary Public ID
     * @returns {Promise<any>}
     */
    async deleteImage(publicId) {
        try {
            if (!publicId) return;

            // Safety check: Don't try to delete if it's not a valid public_id (e.g. strict check or just try)
            // Cloudinary destroy returns { result: 'ok' } or { result: 'not found' } - it doesn't throw usually.
            const result = await cloudinary.uploader.destroy(publicId);
            return result;
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
            // We usually don't want to throw here to prevent blocking main flows (like product deletion)
            // just log it.
            return null;
        }
    }
}

module.exports = new CloudinaryService();

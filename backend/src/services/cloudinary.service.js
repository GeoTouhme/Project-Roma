const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const getBlurDataURL = require('../config/getBlurDataURL');

const PYTHON = path.join(__dirname, '../../venv-rembg/bin/python');
const BG_SCRIPT = path.join(__dirname, '../../scripts/remove-bg-white.py');

class CloudinaryService {
    /**
     * Check whether local background-removal tooling is available.
     */
    static hasBgRemoval() {
        return fs.existsSync(PYTHON) && fs.existsSync(BG_SCRIPT);
    }

    /**
     * Remove background and add pure white using local rembg.
     * Returns path to the processed image (new file).
     */
    removeBackground(inputPath) {
        const ext = path.extname(inputPath);
        const base = inputPath.replace(ext, '');
        const outputPath = `${base}_white${ext}`;
        const cmd = `${PYTHON} "${BG_SCRIPT}" "${inputPath}" "${outputPath}"`;
        execSync(cmd, { stdio: 'pipe' });
        return outputPath;
    }

    /**
     * Upload a file to Cloudinary
     * @param {string} filePath - Local path to the file
     * @param {string} folder - Cloudinary folder name (default: 'balport-products')
     * @param {object} options - Upload options
     * @param {boolean} options.removeBackground - Run local AI background removal + white bg (default: true for balport-products)
     * @returns {Promise<{url: string, public_id: string, blurDataURL: string}>}
     */
    async uploadImage(filePath, folder = 'balport-products', options = {}) {
        try {
            if (!filePath) {
                throw new Error('No file path provided for upload');
            }

            let uploadPath = filePath;
            let processedPath = null;

            const removeBg = options.removeBackground !== false; // default true

            if (removeBg && CloudinaryService.hasBgRemoval()) {
                try {
                    processedPath = this.removeBackground(filePath);
                    uploadPath = processedPath;
                } catch (err) {
                    console.error('Background removal failed, falling back to original:', err.message);
                    uploadPath = filePath;
                }
            }

            const result = await cloudinary.uploader.upload(uploadPath, {
                folder: folder,
                resource_type: 'image',
            });

            const blurDataURL = await getBlurDataURL(result.secure_url);

            // Clean up local files
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                if (processedPath && fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
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
            const result = await cloudinary.uploader.destroy(publicId);
            return result;
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
            return null;
        }
    }
}

module.exports = new CloudinaryService();

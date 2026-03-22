const CloudinaryService = require('../services/cloudinary.service');

const deleteFile = async (req, res) => {
  try {
    const id = req.params.id;
    // Assuming 'id' matches the Cloudinary public_id
    if (id) {
      await CloudinaryService.deleteImage(id);
    }
    res.status(200).json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
module.exports = { deleteFile };

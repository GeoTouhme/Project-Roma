// Import the cloudinary module
const cloudinary = require("./cloudinary");

const uploadOnCloudinary = file => {
	return cloudinary.uploader.unsigned_upload(file);
};

const deleteFromCloudinary = file => {
	return cloudinary.uploader.destroy(file);
};

exports.multiFileUploader = async images => {
	const cloudinaryImageUploadMethod = async file => {
		const image = await uploadOnCloudinary(file);
		return image;
	};

	var imageUrlList = [];

	for (var i = 0; i < images.length; i++) {
		var localFilePath = images[i];

		// Upload the local image to Cloudinary
		// and get image url as response
		var result = await cloudinaryImageUploadMethod(localFilePath);
		imageUrlList.push(result);
	}
	const uploaded = imageUrlList.map(v => {
		return {
			_id: v.public_id,
			url: v.secure_url,
		};
	});
	return uploaded;
};

exports.singleFileUploader = async image => {
	const result = await uploadOnCloudinary(image);
	const uploaded = {
		_id: result.public_id,
		url: result.secure_url,
	};
	return uploaded;
};

exports.singleFileDelete = async id => {
	const result = await deleteFromCloudinary(id);
	return result;
};

// exports.multiFilesDelete = async images => {
// 	var imageUrlList = [];
// 	for (var i = 0; i < images.length; i++) {
// 		var localFilePath = images[i];

// 		// Upload the local image to Cloudinary
// 		// and get image url as response
// 		var result = await deleteFromCloudinary(localFilePath._id);
// 		imageUrlList.push(result);
// 	}
// 	return result;
// };
exports.multiFilesDelete = async images => {
	const results = [];

	for (var i = 0; i < images.length; i++) {
		var image = images[i];

		// Delete the image from Cloudinary
		var result = await deleteFromCloudinary(image._id);
		results.push(result);
	}

	return results;
};

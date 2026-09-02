const getBlurDataURL = async (url) => {
  if (!url) {
    return null;
  }

  const prefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;

  // For local /api/images/ URLs, return a tiny transparent placeholder
  // (real blur was generated when the image was first uploaded to Cloudinary).
  if (!url.startsWith(prefix)) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }

  const suffix = url.split(prefix)[1];
  const response = await fetch(
    `${prefix}w_100,e_blur:5000,q_auto,f_auto/${suffix}`
  );
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

module.exports = getBlurDataURL;

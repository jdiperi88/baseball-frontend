// imageLoader.js

// Create a context for all images inside the assets/images directory
const imageContext = require.context(
  "./assets/images",
  false,
  /\.(png|jpe?g|webp)$/
);

function loadImage(imageName) {
  try {
    // return imageContext(`./${imageName}`);
    return `http://diperi.home/minio/baseball-frontend/assets/images/${imageName}`;
  } catch (error) {
    console.error(`Failed to load image: ${imageName}`, error);
    return null; // or a default/fallback image if you have one
  }
}

export default loadImage;

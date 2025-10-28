export const DEFAULT_PORT = 3008;

export const { PORT = DEFAULT_PORT, NODE_ENV = 'production' } = process.env;

// pulled from https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types#image_file_type_details
export const imageExtensions = [
	// APNG
	'.apng',
	// AVIF
	'.avif',
	// BMP
	'.bmp',
	// GIF
	'.gif',
	// ICO
	'.ico',
	// JPEG
	'.jpg',
	'.jpeg',
	'.jpe',
	'.jif',
	'.jfif',
	// PNG
	'.png',
	// SVG
	'.svg',
	// TIFF
	'.tif',
	'.tiff',
	// WebP
	'.webp',
];

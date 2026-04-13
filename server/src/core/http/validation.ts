/**
 * Audio file extension validation
 */
export const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a)$/i;

/**
 * Image file extension validation
 */
export const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

/**
 * Maximum audio file size (100MB)
 */
export const MAX_AUDIO_SIZE = 100 * 1024 * 1024;

/**
 * Maximum image file size (50MB)
 */
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

/**
 * Check if filename is a valid audio file
 */
export function isValidAudioFile(filename: string): boolean {
    return AUDIO_EXTENSIONS.test(filename);
}

/**
 * Check if filename is a valid image file
 */
export function isValidImageFile(filename: string): boolean {
    return IMAGE_EXTENSIONS.test(filename);
}

/**
 * Validate file size is within limits
 */
export function validateFileSize(size: number, maxSize: number): boolean {
    return size > 0 && size <= maxSize;
}

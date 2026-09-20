// backend/middleware/upload.js
// Multer configuration for file uploads
'use strict';

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOC_TYPES,
  MAX_FILE_SIZE,
} = require('../config/constants');

// ─── Storage Engine ───────────────────────────────────────────────────────────

/**
 * Create a disk storage engine that puts files in the correct subfolder.
 * @param {string} subdir - 'images' | 'videos' | 'audio' | 'documents'
 */
function createStorage(subdir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const uploadPath = path.join(__dirname, '..', 'uploads', subdir);
      cb(null, uploadPath);
    },
    filename(req, file, cb) {
      const ext      = path.extname(file.originalname).toLowerCase();
      const unique   = uuidv4();
      cb(null, `${unique}${ext}`);
    },
  });
}

// Generic storage for any file type
const genericStorage = multer.diskStorage({
  destination(req, file, cb) {
    const mime = file.mimetype;
    let subdir = 'documents';
    if (ALLOWED_IMAGE_TYPES.includes(mime)) subdir = 'images';
    else if (ALLOWED_VIDEO_TYPES.includes(mime)) subdir = 'videos';
    else if (ALLOWED_AUDIO_TYPES.includes(mime)) subdir = 'audio';
    cb(null, path.join(__dirname, '..', 'uploads', subdir));
  },
  filename(req, file, cb) {
    const ext    = path.extname(file.originalname).toLowerCase();
    const unique = uuidv4();
    cb(null, `${unique}${ext}`);
  },
});

// ─── File Filters ─────────────────────────────────────────────────────────────

function imageFilter(req, file, cb) {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
}

function videoFilter(req, file, cb) {
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only video files are allowed (MP4, WebM, OGG)'));
}

function audioFilter(req, file, cb) {
  if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only audio files are allowed (MP3, OGG, WAV, WebM)'));
}

function docFilter(req, file, cb) {
  if (ALLOWED_DOC_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('File type not allowed'));
}

function anyFilter(req, file, cb) {
  const allAllowed = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_AUDIO_TYPES,
    ...ALLOWED_DOC_TYPES,
  ];
  if (allAllowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('File type not allowed'));
}

// ─── Multer Instances ─────────────────────────────────────────────────────────

const limits = { fileSize: MAX_FILE_SIZE };

const uploadImage    = multer({ storage: createStorage('images'),    fileFilter: imageFilter, limits }).single('file');
const uploadVideo    = multer({ storage: createStorage('videos'),    fileFilter: videoFilter, limits }).single('file');
const uploadAudio    = multer({ storage: createStorage('audio'),     fileFilter: audioFilter, limits }).single('file');
const uploadDoc      = multer({ storage: createStorage('documents'), fileFilter: docFilter,   limits }).single('file');
const uploadAny      = multer({ storage: genericStorage,             fileFilter: anyFilter,   limits }).single('file');
const uploadAvatar   = multer({ storage: createStorage('images'),    fileFilter: imageFilter, limits: { fileSize: 2 * 1024 * 1024 } }).single('avatar');
const uploadGroupImg = multer({ storage: createStorage('images'),    fileFilter: imageFilter, limits: { fileSize: 2 * 1024 * 1024 } }).single('avatar');

module.exports = {
  uploadImage,
  uploadVideo,
  uploadAudio,
  uploadDoc,
  uploadAny,
  uploadAvatar,
  uploadGroupImg,
};

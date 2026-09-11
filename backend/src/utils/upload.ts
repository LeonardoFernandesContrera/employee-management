import multer from "multer";

export const MAX_XLSX_FILE_SIZE = 5 * 1024 * 1024;
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_XLSX_FILE_SIZE },
});

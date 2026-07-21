"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const validate_1 = require("../middlewares/validate");
const userValidator_1 = require("../validators/userValidator");
/** Multer solo si viene multipart; no toca body JSON (editar usuario / contraseña). */
const optionalPhotoUpload = (req, res, next) => {
    const contentType = String(req.headers["content-type"] || "");
    if (contentType.includes("multipart/form-data")) {
        return upload_1.upload.single("photo")(req, res, next);
    }
    return next();
};
const router = express_1.default.Router();
router.post("/login", userValidator_1.loginUserValidator, validate_1.validate, userController_1.loginUser);
router.post("/register", upload_1.upload.single("photo"), userValidator_1.registerUserValidator, validate_1.validate, userController_1.registerUser);
router.get("/", userController_1.getUser);
router.get("/:id", userController_1.getUserById);
router.post("/", userController_1.createUser);
router.patch("/:id/photo", auth_1.verifyToken, upload_1.upload.single("photo"), userController_1.updateUserPhoto);
router.patch("/:id", optionalPhotoUpload, userController_1.updateUser);
router.delete("/:id", userController_1.deleteUser);
// Recuperación activa: POST /api/auth/forgot-password y /api/auth/reset-password (Resend + código).
// Estas rutas legacy usan Gmail/enlace y no deben usarse desde la app.
router.post("/forgot-password", userController_1.forgotPassword);
router.post("/reset-password/:token", userController_1.resetPassword);
exports.default = router;

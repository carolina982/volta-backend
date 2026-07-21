"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMailerConfigured = exports.transporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("./config");
exports.transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS en el puerto 587
    auth: {
        user: config_1.EMAIL_USER,
        pass: config_1.EMAIL_PASS?.trim(),
    },
});
/** true si hay credenciales de Gmail configuradas. */
const isMailerConfigured = () => Boolean(config_1.EMAIL_USER && config_1.EMAIL_PASS);
exports.isMailerConfigured = isMailerConfigured;

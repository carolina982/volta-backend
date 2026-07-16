import nodemailer from "nodemailer";
import { EMAIL_PASS, EMAIL_USER } from "./config";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS en el puerto 587
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS?.trim(),
  },
});

/** true si hay credenciales de Gmail configuradas. */
export const isMailerConfigured = () => Boolean(EMAIL_USER && EMAIL_PASS);

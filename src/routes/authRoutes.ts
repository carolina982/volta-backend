import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { EMAIL_FROM, JWT_SECRET } from "../config/config";
import { resend } from "../config/resend";
import Trip from "../models/Trip";
import User, { hashPassword, isBcryptHash } from "../models/User";



const router = Router();

let resetToken="";

const generateResetCode=()=>{
  return crypto.randomInt(100000,999999).toString();
};

console.log("authRoutes cargando correctamente");
// REGISTER

router.put("/trips/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Token no proporcionado" });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    const trip = await Trip.findById(id);

    if (!trip) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    if (user.rol === "admin") {
      Object.assign(trip, req.body);
    } else {
      if (trip.conductorId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "No autorizado" });
      }

      if (req.body.fechaLlegada) {
        trip.fechaLlegada = req.body.fechaLlegada;
        trip.estado = "completado";
      }
    }

    await trip.save();

    res.json({ message: "Viaje actualizado", trip });

  } catch (error) {
    console.error("Error actualizando viaje:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
});
// LOGIN
router.post("/login", async (req, res) => {
  try {
    // "email" puede ser un correo o un nombre de usuario (se acepta cualquiera).
    const { email, identifier, password } = req.body;
    const rawIdentifier = String(identifier ?? email ?? "").trim();

    if (!rawIdentifier || !password) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Busca por correo (exacto, en minúsculas) o por nombre (sin distinguir mayúsculas).
    const user = await User.findOne({
      $or: [
        { email: rawIdentifier.toLowerCase() },
        { nombre: new RegExp(`^${escapeRegex(rawIdentifier)}$`, "i") },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$nombre", " ", { $ifNull: ["$apellido", ""] }] },
              regex: `^${escapeRegex(rawIdentifier)}$`,
              options: "i",
            },
          },
        },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Este usuario no tiene acceso al inicio de sesión",
      });
    }

    const passwordValid = await user.comparePassword(password);

    if (!passwordValid) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!isBcryptHash(user.password)) {
      user.password = await hashPassword(password);
      user.markModified("password");
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    const { password: _pass, resetToken: _rt, resetTokenExp: _rte, ...userData } = user.toObject();

    return res.json({
      message: "Inicio de sesión exitoso",
      token,
      user: userData,
    });

  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+resetToken +resetTokenExp");

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    //  generar código correctamente
    const resetToken = generateResetCode();

    //  guardar token en DB
    user.resetToken = resetToken;
    user.resetTokenExp=new Date(Date.now()+10 *60 *1000);
    await user.save();

    const nombreUsuario = [user.nombre, user.apellido].filter(Boolean).join(" ").trim() || "Hola";

    // enviar correo AL CORREO DEL USUARIO que lo solicitó (antes estaba fijo)
    const { data, error } = await resend.emails.send({
      from: `Volta App <${EMAIL_FROM}>`,
      to: user.email,
      subject: "Recuperación de contraseña",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f3f4f6;border-radius:16px">
          <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb">
            <h2 style="margin:0 0 8px;color:#111111;font-size:20px">Recuperación de contraseña</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px">${nombreUsuario}, usa este código para restablecer tu contraseña:</p>
            <div style="text-align:center;margin:20px 0">
              <span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;color:#111111;background:#f3f4f6;border-radius:12px;padding:14px 22px">${resetToken}</span>
            </div>
            <p style="margin:0;color:#9ca3af;font-size:13px">Este código expira en 10 minutos. Si no solicitaste esto, ignora este correo.</p>
          </div>
        </div>
      `,
    });

    // Resend NO lanza excepción: hay que revisar el campo `error`.
    if (error) {
      console.error("Error de Resend al enviar correo:", error);
      return res.status(502).json({
        message:
          "No se pudo enviar el correo. Revisa que el dominio remitente (EMAIL_FROM) esté verificado en Resend.",
        error: (error as any)?.message || String(error),
      });
    }

    console.log("Correo de recuperación enviado a", user.email, "id:", data?.id);
    return res.json({
      message: "Código enviado correctamente",
    });
  } catch (error:any) {
    console.log("erro full");
    console.dir(error,{depth:null});
    console.log("Code",error?.code);
    console.log("Response",error?.response);
    console.log("Response code",error?.responseCode)
    console.error("Error en forgot-password:", error);
    return res.status(500).json({
      message: "No se pudo enviar el correo",
      error: (error as any).message,
    });
  }
});


// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetToken: token,
      resetTokenExp: { $gt: new Date() },
    }).select("+password +resetToken +resetTokenExp");

    if (!user) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    user.password = await hashPassword(String(newPassword).trim());
    user.markModified("password");
    user.resetToken = undefined;
    user.resetTokenExp = undefined;

    await user.save();

    return res.json({
      message: "Contraseña actualizada correctamente",
    });

  } catch (error) {
    console.error("Error en reset-password", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
});

export default router;
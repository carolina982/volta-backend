"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.deleteUser = exports.updateUserPhoto = exports.updateUser = exports.loginUser = exports.registerUser = exports.createUser = exports.getUserById = exports.getUser = void 0;
const crypto = __importStar(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const mailer_1 = require("../config/mailer");
const User_1 = __importStar(require("../models/User"));
const PUBLIC_USER_FIELDS = "-password -resetToken -resetTokenExp";
/** Resuelve apellidos desde el body (soporta campos nuevos o el apellido legado). */
const resolveApellidos = (body) => {
    const hasSplit = body.apellidoPaterno !== undefined || body.apellidoMaterno !== undefined;
    if (hasSplit) {
        const apellidoPaterno = String(body.apellidoPaterno ?? "").trim();
        const apellidoMaterno = String(body.apellidoMaterno ?? "").trim();
        return {
            apellidoPaterno,
            apellidoMaterno,
            apellido: (0, User_1.joinApellidos)(apellidoPaterno, apellidoMaterno),
        };
    }
    const apellido = String(body.apellido ?? "").trim();
    return {
        apellidoPaterno: apellido,
        apellidoMaterno: "",
        apellido,
    };
};
const getUser = async (req, res) => {
    try {
        const filter = {};
        const activoQ = String(req.query.activo ?? "").toLowerCase();
        if (activoQ === "true" || activoQ === "1") {
            // Incluye documentos antiguos sin el campo (se tratan como activos).
            filter.$or = [{ activo: true }, { activo: { $exists: false } }];
        }
        else if (activoQ === "false" || activoQ === "0") {
            filter.activo = false;
        }
        const users = await User_1.default.find(filter)
            .select(PUBLIC_USER_FIELDS)
            .sort({ nombre: 1, apellido: 1 });
        return res.json(users);
    }
    catch (error) {
        console.error("Error obteniendo usuarios:", error);
        return res.status(500).json({ message: "Error en el servidor" });
    }
};
exports.getUser = getUser;
const getUserById = async (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
        return res.status(400).json({ message: "ID de usuario inválido" });
    }
    try {
        const user = await User_1.default.findById(id).select(PUBLIC_USER_FIELDS);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        return res.json(user);
    }
    catch (error) {
        console.error("Error obteniendo usuario:", error);
        return res.status(500).json({ message: "Error en el servidor" });
    }
};
exports.getUserById = getUserById;
const VALID_ROLES = ["Admin", "Operador", "Ayudante General"];
const normalizeRole = (rol) => {
    const trimmed = String(rol || "").trim();
    // Compatibilidad con formularios antiguos
    if (trimmed.toLowerCase() === "chofer")
        return "Operador";
    const match = VALID_ROLES.find((validRole) => validRole.toLowerCase() === trimmed.toLowerCase());
    return match ?? null;
};
const createUser = async (req, res) => {
    try {
        const { nombre, email, password, rol, contacto, activo } = req.body;
        const apellidos = resolveApellidos(req.body);
        if (!nombre || !apellidos.apellidoPaterno || !rol) {
            return res.status(400).json({
                message: "Nombre, apellido paterno y rol son obligatorios",
            });
        }
        const role = normalizeRole(rol);
        if (!role) {
            return res.status(400).json({ message: "Rol no válido" });
        }
        const emailTrim = email ? String(email).trim().toLowerCase() : "";
        const passwordTrim = password ? String(password).trim() : "";
        // Nombre/apellidos bastan al crear. Correo/contraseña/contacto son opcionales
        // (si se envían, se guardan; el acceso se puede completar al editar).
        if (emailTrim) {
            const existingUser = await User_1.default.findOne({ email: emailTrim });
            if (existingUser) {
                return res.status(400).json({ message: "Usuario ya existe" });
            }
        }
        if (passwordTrim && passwordTrim.length < 6) {
            return res.status(400).json({
                message: "La contraseña debe tener al menos 6 caracteres",
            });
        }
        if ((emailTrim && !passwordTrim) || (!emailTrim && passwordTrim)) {
            return res.status(400).json({
                message: "Si das acceso, envía correo y contraseña juntos",
            });
        }
        const hashedPassword = passwordTrim ? await (0, User_1.hashPassword)(passwordTrim) : undefined;
        const isActivo = activo === undefined || activo === null ? true : Boolean(activo);
        const user = await User_1.default.create({
            nombre: String(nombre).trim(),
            apellido: apellidos.apellido,
            apellidoPaterno: apellidos.apellidoPaterno,
            apellidoMaterno: apellidos.apellidoMaterno,
            rol: role,
            activo: isActivo,
            ...(emailTrim ? { email: emailTrim } : {}),
            ...(hashedPassword ? { password: hashedPassword } : {}),
            ...(contacto != null && String(contacto).trim()
                ? { contacto: String(contacto).trim() }
                : {}),
        });
        const userObj = user.toObject();
        delete userObj.password;
        return res.status(201).json(userObj);
    }
    catch (error) {
        console.error("Error creando usuario ", error);
        if (error?.code === 11000) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }
        if (error?.name === "ValidationError") {
            return res.status(400).json({
                message: Object.values(error.errors || {})
                    .map((e) => e.message)
                    .join(". ") || "Datos inválidos",
            });
        }
        return res.status(500).json({
            message: "Error creando usuario",
        });
    }
};
exports.createUser = createUser;
// Registrar usuario
const registerUser = async (req, res) => {
    try {
        const { nombre, email, password, rol, contacto } = req.body;
        const apellidos = resolveApellidos(req.body);
        if (!nombre || !apellidos.apellidoPaterno || !email || !password || !rol) {
            return res.status(400).json({ message: "Faltan datos obligatorios" });
        }
        const role = normalizeRole(rol);
        if (!role) {
            return res.status(400).json({
                message: "Rol no válido. Usa Admin, Operador o Ayudante General",
            });
        }
        const existingUser = await User_1.default.findOne({
            email: email.toLowerCase(),
        });
        if (existingUser) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }
        const hashedPassword = await (0, User_1.hashPassword)(String(password).trim());
        const newUser = await User_1.default.create({
            nombre,
            apellido: apellidos.apellido,
            apellidoPaterno: apellidos.apellidoPaterno,
            apellidoMaterno: apellidos.apellidoMaterno,
            email: email.toLowerCase(),
            password: hashedPassword,
            rol: role,
            contacto,
            photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
        });
        const token = jsonwebtoken_1.default.sign({ id: newUser._id, email: newUser.email, rol: newUser.rol }, config_1.JWT_SECRET, { expiresIn: "1d" });
        return res.status(201).json({
            _id: newUser._id,
            nombre: newUser.nombre,
            apellido: newUser.apellido,
            apellidoPaterno: newUser.apellidoPaterno || "",
            apellidoMaterno: newUser.apellidoMaterno || "",
            email: newUser.email,
            rol: newUser.rol,
            contacto: newUser.contacto,
            photoUrl: newUser.photoUrl || null,
            token,
        });
    }
    catch (error) {
        console.error("Error registrando usuario", error);
        if (error?.code === 11000) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }
        if (error?.name === "ValidationError") {
            return res.status(400).json({
                message: Object.values(error.errors || {})
                    .map((e) => e.message)
                    .join(". ") || "Datos inválidos",
            });
        }
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};
exports.registerUser = registerUser;
// Login usuario
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Faltan datos" });
    }
    try {
        const cleanEmail = email.trim().toLowerCase();
        const user = await User_1.default.findOne({ email: cleanEmail }).select("+password");
        if (!user) {
            return res.status(401).json({
                message: "Usuario o contraseña incorrectos",
            });
        }
        if (user.activo === false) {
            return res.status(403).json({
                message: "Este usuario está desactivado. Contacta al administrador.",
            });
        }
        if (!user.password) {
            return res.status(401).json({
                message: "Este usuario no tiene acceso al inicio se sion "
            });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                message: "Usuario o contraseña incorrectos",
            });
        }
        // Migra contraseñas viejas en texto plano la primera vez que hacen login
        if (!(0, User_1.isBcryptHash)(user.password)) {
            user.password = await (0, User_1.hashPassword)(password);
            user.markModified("password");
            await user.save();
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, rol: user.rol }, config_1.JWT_SECRET, { expiresIn: "1d" });
        return res.json({
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            apellidoPaterno: user.apellidoPaterno || "",
            apellidoMaterno: user.apellidoMaterno || "",
            email: user.email,
            rol: user.rol,
            activo: true,
            photoUrl: user.photoUrl || null,
            contacto: user.contacto,
            token,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Error en el servidor" });
    }
};
exports.loginUser = loginUser;
const updateUser = async (req, res) => {
    try {
        const { nombre, email, password, rol, contacto, activo } = req.body;
        const user = await User_1.default.findById(req.params.id).select("+password");
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        if (nombre !== undefined)
            user.nombre = String(nombre).trim();
        if (req.body.apellidoPaterno !== undefined ||
            req.body.apellidoMaterno !== undefined) {
            const paterno = req.body.apellidoPaterno !== undefined
                ? String(req.body.apellidoPaterno).trim()
                : String(user.apellidoPaterno || "").trim();
            const materno = req.body.apellidoMaterno !== undefined
                ? String(req.body.apellidoMaterno).trim()
                : String(user.apellidoMaterno || "").trim();
            user.apellidoPaterno = paterno;
            user.apellidoMaterno = materno;
            user.apellido = (0, User_1.joinApellidos)(paterno, materno);
        }
        else if (req.body.apellido !== undefined) {
            const apellidos = resolveApellidos({ apellido: req.body.apellido });
            user.apellidoPaterno = apellidos.apellidoPaterno;
            user.apellidoMaterno = apellidos.apellidoMaterno;
            user.apellido = apellidos.apellido;
        }
        if (email !== undefined) {
            const nextEmail = String(email).trim().toLowerCase();
            if (nextEmail) {
                user.email = nextEmail;
            }
            else {
                user.set("email", undefined);
            }
        }
        if (contacto !== undefined)
            user.contacto = String(contacto).trim();
        if (activo !== undefined && activo !== null) {
            user.activo = Boolean(activo);
        }
        if (rol !== undefined) {
            const role = normalizeRole(String(rol));
            if (!role) {
                return res.status(400).json({
                    message: "Rol no válido. Usa Admin, Operador o Ayudante General",
                });
            }
            user.rol = role;
        }
        if (password !== undefined && password !== null && String(password).trim() !== "") {
            const plain = String(password).trim();
            if (plain.length < 6) {
                return res.status(400).json({
                    message: "La contraseña debe tener al menos 6 caracteres",
                });
            }
            if (!user.email) {
                return res.status(400).json({
                    message: "El usuario necesita un correo para poder iniciar sesión con contraseña",
                });
            }
            // Hash explícito al editar (no se guarda en texto plano)
            user.password = await (0, User_1.hashPassword)(plain);
            user.markModified("password");
        }
        if (req.file) {
            user.photoUrl = `/uploads/${req.file.filename}`;
        }
        await user.save();
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.resetToken;
        delete userObj.resetTokenExp;
        return res.json(userObj);
    }
    catch (error) {
        console.error("Error al actualizar usuario", error);
        if (error?.code === 11000) {
            return res.status(400).json({ message: "El correo ya está en uso" });
        }
        if (error?.name === "ValidationError") {
            return res.status(400).json({
                message: Object.values(error.errors || {})
                    .map((e) => e.message)
                    .join(". ") || "Datos inválidos",
            });
        }
        return res.status(500).json({ message: "Error al actualizar usuario" });
    }
};
exports.updateUser = updateUser;
/** Solo actualiza la foto de perfil (Operador / Ayudante desde Mi Perfil). */
const updateUserPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Debes seleccionar una imagen" });
        }
        const authUser = req.user;
        const targetId = String(req.params.id || "");
        const authId = String(authUser?._id || authUser?.id || "");
        const role = String(authUser?.rol || "").toLowerCase();
        const isAdmin = role === "admin";
        if (!isAdmin && authId && targetId && authId !== targetId) {
            return res.status(403).json({
                message: "No puedes cambiar la foto de otro usuario",
            });
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { photoUrl: `/uploads/${req.file.filename}` }, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        const userObj = user.toObject();
        delete userObj.password;
        return res.json(userObj);
    }
    catch (error) {
        console.error("Error al actualizar foto", error);
        return res.status(500).json({ message: "Error al actualizar la foto" });
    }
};
exports.updateUserPhoto = updateUserPhoto;
/** Desactiva el usuario (soft delete). No se borra de la base de datos. */
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User_1.default.findByIdAndUpdate(id, { activo: false }, { new: true }).select(PUBLIC_USER_FIELDS);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        return res.json({
            message: "Usuario desactivado correctamente",
            user,
        });
    }
    catch (error) {
        console.error("Error desactivando usuario", error);
        return res.status(500).json({ message: "Error desactivando usuario" });
    }
};
exports.deleteUser = deleteUser;
const forgotPassword = async (req, res) => {
    console.log("📩 Petición recibida en forgotPassword:", req.body);
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email es requerido" });
    }
    try {
        const user = await User_1.default.findOne({ email: email.toLowerCase() }).select("+resetToken +resetTokenExp");
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        const token = crypto.randomBytes(32).toString("hex");
        user.resetToken = token;
        user.resetTokenExp = new Date(Date.now() + 3600000);
        await user.save();
        const resetUrl = `https://volta-backend-px1a.onrender.com/api/users/reset-password/${token}`;
        await mailer_1.transporter.sendMail({
            to: user.email,
            from: "correo@volta.com",
            subject: "Restablece tu contraseña",
            html: `<p>Solicitaste restablecer tu contraseña</p>
             <p>Haz clic aqui para crear una nueva contraseña:</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>Este enlace expira en 1 hora</p>`,
        });
        res.json({ message: "Correo enviado correctamente" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al enviar correo" });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    try {
        const user = await User_1.default.findOne({
            resetToken: token,
            resetTokenExp: { $gt: new Date() },
        }).select("+password +resetToken +resetTokenExp");
        if (!user) {
            return res.status(400).json({ message: "Token inválido o expirado" });
        }
        // Hash explícito; el pre('save') no vuelve a hashear si ya es bcrypt
        user.password = await (0, User_1.hashPassword)(String(password).trim());
        user.markModified("password");
        user.resetToken = undefined;
        user.resetTokenExp = undefined;
        await user.save();
        res.json({ message: "Contraseña restablecida correctamente" });
    }
    catch (error) {
        console.error("Error en resetPassword", error);
        res.status(500).json({ message: "Error al restablecer contraseña" });
    }
};
exports.resetPassword = resetPassword;

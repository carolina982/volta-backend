"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const unitController_1 = require("../controllers/unitController");
const authorize_1 = require("../middlewares/authorize");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const validate_1 = require("../middlewares/validate");
const Unit_1 = __importDefault(require("../models/Unit"));
const User_1 = __importDefault(require("../models/User"));
const unitValidator_1 = require("../validators/unitValidator");
const uploadDir = path_1.default.join(__dirname, "../../uploads");
const router = (0, express_1.Router)();
router.get("/count", unitController_1.getUnitCount);
router.post("/", unitValidator_1.createUnitValidator, validate_1.validate, unitController_1.createUnit);
router.get("/", unitController_1.getUnits);
router.get("/:id", unitController_1.getUnitById);
router.put("/:id", unitValidator_1.updateUnitValidator, validate_1.validate, unitController_1.updateUnit);
router.delete("/:id", unitController_1.deleteUnit);
router.post("/:id/image", upload_1.upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No se recibió imagen",
            });
        }
        const unit = await Unit_1.default.findById(req.params.id);
        if (!unit) {
            return res.status(404).json({
                error: "Unidad no encontrada",
            });
        }
        const imagenUrl = `https://${req.get("host")}/uploads/${req.file.filename}`;
        unit.imagenUrl = imagenUrl;
        await unit.save();
        res.json({
            ok: true,
            imagenUrl,
        });
    }
    catch (error) {
        console.error("ERROR IMAGEN", error);
        res.status(500).json({
            error: "Error subiendo imagen",
        });
    }
});
// Crear un inventario de entrega (texto libre + firma). Solo Admin. Histórico: no se sobrescribe.
router.post("/:id/inventarios", auth_1.verifyToken, (0, authorize_1.authorize)(["Admin"]), async (req, res) => {
    try {
        const { contenido, operadorId, firmaBase64 } = req.body || {};
        if (!contenido || !String(contenido).trim()) {
            return res.status(400).json({ error: "El inventario no puede estar vacío" });
        }
        if (!firmaBase64 || typeof firmaBase64 !== "string") {
            return res.status(400).json({ error: "Falta la firma" });
        }
        const matches = firmaBase64.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: "Firma inválida" });
        }
        const unit = await Unit_1.default.findById(req.params.id);
        if (!unit) {
            return res.status(404).json({ error: "Unidad no encontrada" });
        }
        // Guardar la firma como archivo PNG en /uploads
        if (!fs_1.default.existsSync(uploadDir))
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        const ext = matches[1] === "png" ? "png" : "jpg";
        const filename = `firma-${Date.now()}.${ext}`;
        fs_1.default.writeFileSync(path_1.default.join(uploadDir, filename), Buffer.from(matches[2], "base64"));
        const firmaUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
        // Operador asignado (nombre snapshot)
        let operadorObjId = null;
        let operadorNombre = "";
        if (operadorId && mongoose_1.default.Types.ObjectId.isValid(operadorId)) {
            operadorObjId = new mongoose_1.default.Types.ObjectId(operadorId);
            const op = await User_1.default.findById(operadorObjId).select("nombre apellido");
            if (op)
                operadorNombre = `${op.nombre || ""} ${op.apellido || ""}`.trim();
        }
        // Admin que crea el registro
        const admin = req.user;
        const creadoPorNombre = admin
            ? `${admin.nombre || ""} ${admin.apellido || ""}`.trim()
            : "";
        if (!unit.inventarios)
            unit.inventarios = [];
        unit.inventarios.push({
            contenido: String(contenido).trim(),
            firmaUrl,
            operadorId: operadorObjId,
            operadorNombre,
            creadoPorId: admin?._id ?? null,
            creadoPorNombre,
            fecha: new Date(),
        });
        await unit.save();
        res.json({ ok: true, inventarios: unit.inventarios });
    }
    catch (error) {
        console.error("ERROR INVENTARIO", error);
        res.status(500).json({ error: "Error guardando inventario" });
    }
});
// Eliminar un inventario específico. Solo Admin.
router.delete("/:id/inventarios/:inventarioId", auth_1.verifyToken, (0, authorize_1.authorize)(["Admin"]), async (req, res) => {
    try {
        const { id, inventarioId } = req.params;
        const unit = await Unit_1.default.findById(id);
        if (!unit) {
            return res.status(404).json({ error: "Unidad no encontrada" });
        }
        const target = (unit.inventarios || []).find((inv) => String(inv._id) === String(inventarioId));
        // Intentar borrar el archivo de firma asociado (si existe localmente)
        if (target?.firmaUrl) {
            try {
                const firmaName = target.firmaUrl.split("/uploads/")[1];
                if (firmaName) {
                    const firmaPath = path_1.default.join(uploadDir, firmaName);
                    if (fs_1.default.existsSync(firmaPath))
                        fs_1.default.unlinkSync(firmaPath);
                }
            }
            catch (e) {
                console.warn("No se pudo borrar el archivo de firma", e);
            }
        }
        unit.inventarios = (unit.inventarios || []).filter((inv) => String(inv._id) !== String(inventarioId));
        await unit.save();
        res.json({ ok: true, inventarios: unit.inventarios });
    }
    catch (error) {
        console.error("ERROR ELIMINANDO INVENTARIO", error);
        res.status(500).json({ error: "Error eliminando inventario" });
    }
});
// Historial de inventarios de una unidad (más reciente primero). Solo Admin.
router.get("/:id/inventarios", auth_1.verifyToken, (0, authorize_1.authorize)(["Admin"]), async (req, res) => {
    try {
        const unit = await Unit_1.default.findById(req.params.id).populate("inventarios.operadorId", "nombre apellido");
        if (!unit) {
            return res.status(404).json({ error: "unidad no encontrada" });
        }
        const list = [...(unit.inventarios || [])].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        res.json(list);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo inventarios" });
    }
});
exports.default = router;

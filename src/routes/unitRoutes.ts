import { Router } from "express";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { createUnit, deleteUnit, getUnitById, getUnitCount, getUnits, updateUnit } from "../controllers/unitController";
import { authorize } from "../middlewares/authorize";
import { verifyToken } from "../middlewares/auth";
import { upload } from "../middlewares/upload";
import { validate } from "../middlewares/validate";
import Unit from "../models/Unit";
import User from "../models/User";
import { createUnitValidator, updateUnitValidator } from "../validators/unitValidator";

const uploadDir = path.join(__dirname, "../../uploads");


const router =Router ();
router.get("/count",getUnitCount)
router.post ("/",createUnitValidator,validate,createUnit);
router.get("/", getUnits);
router.get("/:id" , getUnitById);
router.put("/:id",updateUnitValidator,validate,updateUnit);

router.delete("/:id" , deleteUnit);
router.post("/:id/image",upload.single("image"),async (req, res) => {
    try {
       if (!req.file) {
        return res.status(400).json({
          error: "No se recibió imagen",
        });
      }
      const unit = await Unit.findById(req.params.id);
      if (!unit) {
        return res.status(404).json({
          error: "Unidad no encontrada",
        });
      }
      const imagenUrl =
        `https://${req.get("host")}/uploads/${req.file.filename}`;
    

      

      unit.imagenUrl = imagenUrl;
      await unit.save();
      res.json({
        ok: true,
        imagenUrl,
      });

    } catch (error) {
      console.error("ERROR IMAGEN", error);
      res.status(500).json({
        error: "Error subiendo imagen",
      });
    }
  }
);

// Crear un inventario de entrega (texto libre + firma). Solo Admin. Histórico: no se sobrescribe.
router.post("/:id/inventarios", verifyToken, authorize(["Admin"]), async (req, res) => {
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

    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ error: "Unidad no encontrada" });
    }

    // Guardar la firma como archivo PNG en /uploads
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const ext = matches[1] === "png" ? "png" : "jpg";
    const filename = `firma-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(matches[2], "base64"));
    const firmaUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;

    // Operador asignado (nombre snapshot)
    let operadorObjId: mongoose.Types.ObjectId | null = null;
    let operadorNombre = "";
    if (operadorId && mongoose.Types.ObjectId.isValid(operadorId)) {
      operadorObjId = new mongoose.Types.ObjectId(operadorId);
      const op = await User.findById(operadorObjId).select("nombre apellido");
      if (op) operadorNombre = `${op.nombre || ""} ${op.apellido || ""}`.trim();
    }

    // Admin que crea el registro
    const admin = (req as any).user;
    const creadoPorNombre = admin
      ? `${admin.nombre || ""} ${admin.apellido || ""}`.trim()
      : "";

    if (!unit.inventarios) unit.inventarios = [];
    unit.inventarios.push({
      contenido: String(contenido).trim(),
      firmaUrl,
      operadorId: operadorObjId,
      operadorNombre,
      creadoPorId: admin?._id ?? null,
      creadoPorNombre,
      fecha: new Date(),
    } as any);

    await unit.save();

    res.json({ ok: true, inventarios: unit.inventarios });
  } catch (error) {
    console.error("ERROR INVENTARIO", error);
    res.status(500).json({ error: "Error guardando inventario" });
  }
});

// Historial de inventarios de una unidad (más reciente primero). Solo Admin.
router.get("/:id/inventarios", verifyToken, authorize(["Admin"]), async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).populate(
      "inventarios.operadorId",
      "nombre apellido"
    );
    if (!unit) {
      return res.status(404).json({ error: "unidad no encontrada" });
    }
    const list = [...(unit.inventarios || [])].sort(
      (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo inventarios" });
  }
});

export default  router;
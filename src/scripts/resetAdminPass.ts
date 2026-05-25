import bcrypt from "bcryptjs";
import express from "express";
import User from "../models/User";

const router = express.Router();
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Faltan datos" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await User.updateOne(
      { email },
      { $set: { password: hash } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({
      message: "Contraseña actualizada correctamente",
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});
export default router;
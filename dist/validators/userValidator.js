"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUserValidator = exports.registerUserValidator = void 0;
const express_validator_1 = require("express-validator");
const VALID_ROLES = ["Admin", "Operador", "Ayudante General"];
exports.registerUserValidator = [
    (0, express_validator_1.body)("nombre").notEmpty().withMessage("El nombre es obligatorio"),
    (0, express_validator_1.body)("apellidoPaterno")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("apellido")
        .custom((value, { req }) => {
        const paterno = String(req.body?.apellidoPaterno || "").trim();
        const legacy = String(value || "").trim();
        if (!paterno && !legacy) {
            throw new Error("El apellido paterno es obligatorio");
        }
        return true;
    }),
    (0, express_validator_1.body)("email").isEmail().withMessage("Correo invalido"),
    (0, express_validator_1.body)("password").notEmpty().withMessage("La contraseña es obligatoria"),
    (0, express_validator_1.body)("rol")
        .notEmpty()
        .custom((value) => {
        const normalized = String(value || "").trim().toLowerCase();
        // Chofer = alias legacy → Operador
        if (normalized === "chofer")
            return true;
        const allowed = VALID_ROLES.map((r) => r.toLowerCase());
        if (!allowed.includes(normalized)) {
            throw new Error("Rol no valido. Usa Admin, Operador o Ayudante General");
        }
        return true;
    }),
    (0, express_validator_1.body)("contacto").notEmpty().withMessage("Ingrese el numero de contacto"),
];
exports.loginUserValidator = [
    (0, express_validator_1.body)("email").isEmail().withMessage("Correo invalido"),
    (0, express_validator_1.body)("password").notEmpty().withMessage("la contraseña es obligatoria"),
];

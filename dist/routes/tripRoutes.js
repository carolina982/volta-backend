"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tripController_1 = require("../controllers/tripController");
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const tripValidator_1 = require("../validators/tripValidator");
/** Si el body solo trae campos de operador, evita el validator del form admin. */
const operadorBodyKeys = new Set([
    "estado",
    "destinoActualIndex",
    "fechaSalida",
    "fechaLlegada",
    "multidestino",
    "destinoExtra",
    "checklistInicio",
    "checklistRecepcion",
    "checklistFin",
    "checklistParada",
]);
const routeOperadorOrAdminUpdate = (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const keys = Object.keys(body);
    const onlyOperadorFields = keys.length > 0 && keys.every((key) => operadorBodyKeys.has(key));
    if (onlyOperadorFields) {
        return (0, tripController_1.updateTripOperador)(req, res);
    }
    return next();
};
const router = (0, express_1.Router)();
router.get("/count", tripController_1.getTripCount);
router.post("/", auth_1.verifyToken, tripValidator_1.createTripValidator, validate_1.validate, tripController_1.createTrip);
router.get("/", auth_1.verifyToken, tripController_1.getTrip);
router.get("/:id", auth_1.verifyToken, tripController_1.getTripById);
/** Acciones de operador (iniciar / parada / finalizar) */
router.patch("/:id/operador", auth_1.verifyToken, tripController_1.updateTripOperador);
router.put("/:id/operador", auth_1.verifyToken, tripController_1.updateTripOperador);
/** PUT normal: si solo cambia estado/ops, usa handler operador (sin validator estricto) */
router.put("/:id", auth_1.verifyToken, routeOperadorOrAdminUpdate, tripValidator_1.updateTripValidator, validate_1.validate, tripController_1.updateTrip);
router.delete("/:id", auth_1.verifyToken, tripController_1.deleteTrip);
exports.default = router;

import { body } from "express-validator";

export const createTripValidator = [
    body("rutaAcubrir").notEmpty().withMessage("El nombre es obligatorio"),
    body("destino").notEmpty().withMessage("El destino es obligatorio"),
    body("fechaSalida").notEmpty().isISO8601().withMessage("Fecha de salida inválida"),
    body("fechaLlegada").optional({nullable: true}).isISO8601().withMessage("Fecha de llegada inválida"),
    body("conductorId").notEmpty().withMessage("El ID del conductor es obligatorio"),
    body("unidadId").notEmpty().withMessage("El Id de la unidad es obligatorio"),
    body("estado").optional().isIn(["pendiente", "en progreso", "en parada", "completado"]).withMessage("Estado no válido"),
    
   
    // Validamos que sea un array y que cada objeto dentro tenga la propiedad 'numero' como un número
    body("kilometrajeSalida").optional().isArray().withMessage("El kilometraje debe ser una lista"),
    body("kilometrajeSalida.*.numero").optional().isNumeric().withMessage("El valor de KM debe ser un número"),
    body("kilometrajeSalida.*.descripcion").optional().isString(),

    body("kilometrajeLlegada").optional().isArray().withMessage("El kilometraje debe ser una lista"),
    body("kilometrajeLlegada.*.numero").optional().isNumeric().withMessage("El valor de KM debe ser un número"),
    body("kilometrajeLlegada.*.descripcion").optional().isString(),
   

    body("acompanante").optional({nullable: true}).isMongoId().withMessage("ID de acompañante inválido"),
    body("def").optional().isString().withMessage("DEF inválido"),
    body("destinoActualIndex").optional().isNumeric().withMessage("Índice de destino inválido"),
];

export const updateTripValidator = [
    body("rutaAcubrir").optional().notEmpty().withMessage("El nombre es obligatorio"),
    body("destino").optional().notEmpty().withMessage("El destino es obligatorio"),
    body("fechaSalida").optional({ nullable: true }).isISO8601().withMessage("Fecha de salida inválida"),
    body("fechaLlegada").optional({ nullable: true }).isISO8601().withMessage("Fecha de llegada inválida"),
    body("conductorId").optional().notEmpty().withMessage("El ID del conductor es obligatorio"),
    body("unidadId").optional().notEmpty().withMessage("El Id de la unidad es obligatorio"),
    body("estado").optional().isIn(["pendiente", "en progreso", "en parada", "completado"]).withMessage("Estado no válido"),
    body("kilometrajeSalida").optional().isArray().withMessage("El kilometraje debe ser una lista"),
    body("kilometrajeSalida.*.numero").optional().isNumeric().withMessage("El valor de KM debe ser un número"),
    body("kilometrajeSalida.*.descripcion").optional().isString(),
    body("kilometrajeLlegada").optional().isArray().withMessage("El kilometraje debe ser una lista"),
    body("kilometrajeLlegada.*.numero").optional().isNumeric().withMessage("El valor de KM debe ser un número"),
    body("kilometrajeLlegada.*.descripcion").optional().isString(),
    body("acompanante").optional({ nullable: true }).custom((value) => {
      if (value === null || value === "" || value === "none") return true;
      if (typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value)) return true;
      throw new Error("ID de acompañante inválido");
    }),
    body("def").optional().isString().withMessage("DEF inválido"),
    body("destinoActualIndex").optional().isNumeric().withMessage("Índice de destino inválido"),
    body("multidestino").optional().isBoolean().withMessage("Multidestino inválido"),
];

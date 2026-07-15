import { Request, Response } from "express";
import mongoose from "mongoose";
import Trip from "../models/Trip";
import {
  notifyAdminsTripCompleted,
  notifyCompanionAssigned,
  notifyTripAssigned,
} from "../services/notificationService";

/** Operador / Chofer / Ayudante: solo ven viajes donde participan */
const isFieldStaffRole = (rol?: string) => {
  const value = (rol || "").toLowerCase();
  return (
    value === "chofer" ||
    value === "operador" ||
    value === "ayudante general" ||
    value === "ayudante"
  );
};

const isOperatorRole = isFieldStaffRole;

const userObjectId = (user: any) => {
  const raw = user?._id || user?.id;
  return raw ? new mongoose.Types.ObjectId(String(raw)) : null;
};

const tripAssignedToUserQuery = (userId: mongoose.Types.ObjectId) => ({
  $or: [
    { conductorId: userId },
    { acompanante: userId },
    { "destinoExtra.conductorId": userId },
    { "destinoExtra.acompanante": userId },
  ],
});

const isTripAssignedToUser = (trip: any, userId: string) => {
  if (String(trip.conductorId) === userId) return true;
  if (trip.acompanante && String(trip.acompanante) === userId) return true;
  const extras = Array.isArray(trip.destinoExtra) ? trip.destinoExtra : [];
  return extras.some(
    (extra: any) =>
      (extra?.conductorId && String(extra.conductorId) === userId) ||
      (extra?.acompanante && String(extra.acompanante) === userId)
  );
};

export const getTrip = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    let trips;
    const uid = userObjectId(user);

    if (isFieldStaffRole(user.rol) && uid) {
      trips = await Trip.find(tripAssignedToUserQuery(uid)).populate(
        "asignadoPor",
        "nombre apellido"
      );
    } else {
      trips = await Trip.find().populate("asignadoPor", "nombre apellido");
    }
    return res.status(200).json(trips);
  } catch (error) {
    console.error("Error al obtener los viajes:", error);
    return res.status(500).json({ message: "Error al obtener los viajes" });
  }
};

export const getTripById = async (req: Request, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id).populate("asignadoPor", "nombre apellido");
    if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

    const user = (req as any).user;
    const userId = String(user?.id || user?._id || "");

    if (isFieldStaffRole(user?.rol) && !isTripAssignedToUser(trip, userId)) {
      return res.status(403).json({ message: "No tienes permiso" });
    }

    res.json(trip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el viaje" });
  }
};

export const createTrip = async (req: Request, res: Response) => {
  try {
    const { 
      rutaAcubrir, 
      unidadId, 
      conductorId, 
      fechaSalida, 
      fechaLlegada, 
      destino, 
      estado, 
      kilometrajeSalida, 
      kilometrajeLlegada, 
      acompanante, 
      def,
      multidestino,
      destinoExtra,
    } = req.body;

    if (!rutaAcubrir || !unidadId || !conductorId || !fechaSalida || !destino || !estado) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const mapKm = (list: any) =>
      Array.isArray(list)
        ? list.map((item: any) => ({
            numero: Number(item.numero),
            descripcion: item.descripcion || "",
          }))
        : [];

    const normalizeDestinosExtras = (extra: any) => {
      const list = Array.isArray(extra) ? extra : extra ? [extra] : [];
      return list.map((item: any) => ({
        destino: String(item.destino || ""),
        fechaSalida: item.fechaSalida ? new Date(item.fechaSalida) : null,
        fechaLlegada: item.fechaLlegada ? new Date(item.fechaLlegada) : null,
        conductorId: item.conductorId
          ? new mongoose.Types.ObjectId(item.conductorId)
          : null,
        unidadId: String(item.unidadId || ""),
        acompanante:
          !item.acompanante || item.acompanante === "none"
            ? null
            : new mongoose.Types.ObjectId(item.acompanante),
        kilometrajeSalida: mapKm(item.kilometrajeSalida),
        kilometrajeLlegada: mapKm(item.kilometrajeLlegada),
      }));
    };

   
const user = (req as any).user;
const asignadoPorId = user?._id || user?.id || null;

const newTrip = new Trip({
  rutaAcubrir,
  unidadId,
  conductorId: new mongoose.Types.ObjectId(conductorId),
  fechaSalida: new Date(fechaSalida),
  fechaLlegada: fechaLlegada ? new Date(fechaLlegada) : null,
  destino,
  estado,
  kilometrajeSalida: mapKm(kilometrajeSalida),
  kilometrajeLlegada: mapKm(kilometrajeLlegada),
  acompanante:
    acompanante === "none" || acompanante === "" || !acompanante
      ? null
      : new mongoose.Types.ObjectId(String(acompanante)),
  def: def || "",
  multidestino: Boolean(multidestino),
  destinoExtra: Boolean(multidestino) ? normalizeDestinosExtras(destinoExtra) : [],
  destinoActualIndex: 0,
  asignadoPor: asignadoPorId ? new mongoose.Types.ObjectId(asignadoPorId) : null,
});

    await newTrip.save();

    try {
      await notifyTripAssigned(newTrip);
      // Notificar acompañantes de destinos extras
      const extras = Array.isArray(newTrip.destinoExtra) ? newTrip.destinoExtra : [];
      for (const extra of extras) {
        if (extra?.acompanante) {
          await notifyCompanionAssigned({
            _id: newTrip._id,
            rutaAcubrir: newTrip.rutaAcubrir,
            destino: String(extra.destino || newTrip.destino),
            acompanante: extra.acompanante,
          });
        }
      }
    } catch (notifyError) {
      console.error("Error enviando notificaciones de asignación:", notifyError);
    }

    res.status(201).json(newTrip);
  } catch (error) {
    console.error("Error creando viaje:", error);
    res.status(500).json({ message: "Error creando viaje", error });
  }
};

export const updateTrip = async (req: Request, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

    const user = (req as any).user;
    const userId = String(user?.id || user?._id || "");
    const isConductor = String(trip.conductorId) === userId;

    // Solo el conductor (o admin) puede editar / avanzar el viaje
    if (isFieldStaffRole(user?.rol) && !isConductor) {
      return res.status(403).json({ message: "No tienes permiso" });
    }

    const estadoAnterior = trip.estado;
    const acompananteAnterior = trip.acompanante ? String(trip.acompanante) : null;

    const {
      rutaAcubrir, 
      destino, 
      fechaLlegada, 
      fechaSalida, 
      kilometrajeSalida, 
      kilometrajeLlegada, 
      estado, 
      unidadId, 
      conductorId, 
      acompanante, 
      def,
      multidestino,
      destinoExtra,
      destinoActualIndex,
    } = req.body;

    
    if (rutaAcubrir !== undefined) trip.rutaAcubrir = rutaAcubrir;
    if (destino !== undefined) trip.destino = destino;
    if (unidadId !== undefined) trip.unidadId = unidadId;
    if (estado !== undefined) trip.estado = estado;
    if (def !== undefined) trip.def = def;
    if (destinoActualIndex !== undefined) {
      trip.destinoActualIndex = Number(destinoActualIndex) || 0;
    }
    
    if (conductorId) trip.conductorId = new mongoose.Types.ObjectId(conductorId);
    if (fechaSalida) trip.fechaSalida = new Date(fechaSalida);
    if (fechaLlegada !== undefined) {
      trip.fechaLlegada = fechaLlegada ? new Date(fechaLlegada) : null;
    }
    if (acompanante !== undefined) {
      trip.acompanante =
        !acompanante || acompanante === "none"
          ? null
          : new mongoose.Types.ObjectId(String(acompanante));
    }
    
    
    if (Array.isArray(kilometrajeSalida)) {
      trip.kilometrajeSalida = kilometrajeSalida;
      trip.markModified('kilometrajeSalida');
    }
    
    if (Array.isArray(kilometrajeLlegada)) {
      trip.kilometrajeLlegada = kilometrajeLlegada;
      trip.markModified('kilometrajeLlegada'); 
    }

    if (multidestino !== undefined) {
      trip.multidestino = Boolean(multidestino);
      if (!trip.multidestino) {
        trip.destinoExtra = [];
      } else if (destinoExtra !== undefined) {
        const list = Array.isArray(destinoExtra) ? destinoExtra : destinoExtra ? [destinoExtra] : [];
        trip.destinoExtra = list.map((item: any) => ({
          destino: String(item.destino || ""),
          fechaSalida: item.fechaSalida ? new Date(item.fechaSalida) : null,
          fechaLlegada: item.fechaLlegada ? new Date(item.fechaLlegada) : null,
          conductorId: item.conductorId
            ? new mongoose.Types.ObjectId(item.conductorId)
            : null,
          unidadId: String(item.unidadId || ""),
          acompanante:
            !item.acompanante || item.acompanante === "none"
              ? null
              : new mongoose.Types.ObjectId(item.acompanante),
          kilometrajeSalida: Array.isArray(item.kilometrajeSalida)
            ? item.kilometrajeSalida.map((km: any) => ({
                numero: Number(km.numero),
                descripcion: km.descripcion || "",
              }))
            : [],
          kilometrajeLlegada: Array.isArray(item.kilometrajeLlegada)
            ? item.kilometrajeLlegada.map((km: any) => ({
                numero: Number(km.numero),
                descripcion: km.descripcion || "",
              }))
            : [],
        })) as any;
        trip.markModified("destinoExtra");
      }
    }

    await trip.save();

    const acompananteNuevo = trip.acompanante ? String(trip.acompanante) : null;
    if (acompananteNuevo && acompananteNuevo !== acompananteAnterior) {
      try {
        await notifyCompanionAssigned({
          _id: trip._id,
          rutaAcubrir: trip.rutaAcubrir,
          destino: trip.destino,
          acompanante: acompananteNuevo,
        });
      } catch (notifyError) {
        console.error("Error notificando acompañante:", notifyError);
      }
    }

    const estadoNuevo = trip.estado;
    const seCompleto =
      String(estadoAnterior).toLowerCase() !== "completado" &&
      String(estadoNuevo).toLowerCase() === "completado";

    if (seCompleto) {
      try {
        const operatorName = isOperatorRole(user?.rol)
          ? [user.nombre, user.apellido].filter(Boolean).join(" ").trim() || "Operador"
          : "Un operador";
        await notifyAdminsTripCompleted(trip, operatorName);
      } catch (notifyError) {
        console.error("Error enviando notificación de viaje finalizado:", notifyError);
      }
    }

    res.json({ message: "Viaje actualizado", trip });
  } catch (error) {
    console.error("Error al actualizar:", error);
    res.status(500).json({ message: "Error al actualizar viaje" });
  }
};

export const deleteTrip = async (req: Request, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

    const user = (req as any).user;
    if (
      isFieldStaffRole(user?.rol) &&
      String(trip.conductorId) !== String(user.id || user._id)
    ) {
      return res.status(403).json({ message: "No tienes permiso" });
    }

    await trip.deleteOne();
    res.json({ message: "Viaje eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar viaje" });
  }
};

export const getTripCount = async (req:Request,res:Response)=>{
  try{
    const count=await Trip.countDocuments();
    res.status(200).json({count});
  }catch (error){
    res.status(500).json({message:"Error al contar los vaijes",error})
  }
}
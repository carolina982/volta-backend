import mongoose from "mongoose";
import Notification, { NotificationType } from "../models/Notification";
import User from "../models/User";
import { sendPushToToken } from "./pushService";

type NotifyPayload = {
  title: string;
  body: string;
  type: NotificationType;
  tripId?: string | mongoose.Types.ObjectId | null;
};

export async function notifyUser(userId: string, payload: NotifyPayload) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;

  await Notification.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: payload.title,
    body: payload.body,
    type: payload.type,
    tripId: payload.tripId ? new mongoose.Types.ObjectId(String(payload.tripId)) : null,
    read: false,
  });

  const user = await User.findById(userId).select("expoPushToken");
  if (user?.expoPushToken) {
    await sendPushToToken(user.expoPushToken, payload.title, payload.body, {
      type: payload.type,
      tripId: payload.tripId ? String(payload.tripId) : "",
    });
  }
}

export async function notifyTripAssigned(trip: {
  _id: mongoose.Types.ObjectId | string;
  rutaAcubrir: string;
  destino: string;
  conductorId: mongoose.Types.ObjectId | string;
  acompanante?: mongoose.Types.ObjectId | string | null;
}) {
  const tripId = String(trip._id);
  const routeLabel = `${trip.rutaAcubrir} → ${trip.destino}`;

  await notifyUser(String(trip.conductorId), {
    title: "Viaje asignado",
    body: `Te asignaron un viaje: ${routeLabel}`,
    type: "trip_assigned",
    tripId,
  });

  if (trip.acompanante && String(trip.acompanante) !== "none") {
    await notifyCompanionAssigned(trip);
  }
}

export async function notifyCompanionAssigned(trip: {
  _id: mongoose.Types.ObjectId | string;
  rutaAcubrir: string;
  destino: string;
  acompanante?: mongoose.Types.ObjectId | string | null;
}) {
  if (!trip.acompanante || String(trip.acompanante) === "none") return;

  const tripId = String(trip._id);
  const routeLabel = `${trip.rutaAcubrir} → ${trip.destino}`;

  await notifyUser(String(trip.acompanante), {
    title: "Vas como acompañante",
    body: `Te asignaron como acompañante en el viaje: ${routeLabel}`,
    type: "companion_assigned",
    tripId,
  });
}

export async function notifyAdminsTripCompleted(
  trip: {
    _id: mongoose.Types.ObjectId | string;
    rutaAcubrir: string;
    destino: string;
  },
  operatorName: string
) {
  const admins = await User.find({ rol: "Admin" }).select("_id");
  const tripId = String(trip._id);
  const body = `${operatorName} finalizó el viaje ${trip.rutaAcubrir} → ${trip.destino}`;

  await Promise.all(
    admins.map((admin) =>
      notifyUser(String(admin._id), {
        title: "Viaje finalizado",
        body,
        type: "trip_completed",
        tripId,
      })
    )
  );
}

/** Avisa a todos los usuarios (excepto quien publicó) que hay un anuncio nuevo. */
export async function notifyAnnouncementPublished(
  announcement: {
    _id: mongoose.Types.ObjectId | string;
    titulo: string;
    contenido: string;
  },
  publisherUserId?: string | null
) {
  const users = await User.find().select("_id");
  const title = "Nuevo anuncio";
  const preview = String(announcement.contenido || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const body = preview
    ? `${announcement.titulo}: ${preview}${preview.length >= 120 ? "…" : ""}`
    : String(announcement.titulo || "Se publicó un aviso nuevo");

  const publisher = publisherUserId ? String(publisherUserId) : "";

  await Promise.all(
    users
      .filter((u) => String(u._id) !== publisher)
      .map((u) =>
        notifyUser(String(u._id), {
          title,
          body,
          type: "announcement_published",
        })
      )
  );
}

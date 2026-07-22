import mongoose from "mongoose";
import { EMAIL_FROM } from "../config/config";
import { resend } from "../config/resend";
import Notification, { NotificationType } from "../models/Notification";
import User from "../models/User";
import { sendPushToToken } from "./pushService";

type NotifyPayload = {
  title: string;
  body: string;
  type: NotificationType;
  tripId?: string | mongoose.Types.ObjectId | null;
};

type TripNotifyInfo = {
  _id: mongoose.Types.ObjectId | string;
  rutaAcubrir: string;
  destino: string;
  asignadoPor?: mongoose.Types.ObjectId | string | null;
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

async function sendTripStatusEmail(params: {
  to: string;
  recipientName: string;
  title: string;
  headline: string;
  detail: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY no configurada: se omite correo de estado de viaje");
    return;
  }

  const { data, error } = await resend.emails.send({
    from: `Volta App <${EMAIL_FROM}>`,
    to: params.to,
    subject: params.title,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f3f4f6;border-radius:16px">
        <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb">
          <h2 style="margin:0 0 8px;color:#111111;font-size:20px">${params.headline}</h2>
          <p style="margin:0 0 12px;color:#6b7280;font-size:14px">Hola ${params.recipientName},</p>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5">${params.detail}</p>
          <p style="margin:0;color:#9ca3af;font-size:13px">Este aviso se envió automáticamente desde Volta.</p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Error de Resend al notificar estado de viaje:", error);
    throw new Error((error as any)?.message || "No se pudo enviar el correo");
  }

  console.log("Correo de estado de viaje enviado a", params.to, "id:", data?.id);
}

/** Destinatarios: quien creó el viaje; si no hay, todos los Admin con correo. */
async function resolveTripAdminRecipients(trip: TripNotifyInfo) {
  const creatorId = trip.asignadoPor ? String(trip.asignadoPor) : "";
  if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) {
    const creator = await User.findById(creatorId).select("_id nombre apellido email");
    if (creator) return [creator];
  }

  return User.find({ rol: "Admin" }).select("_id nombre apellido email");
}

async function notifyTripCreatorStatus(
  trip: TripNotifyInfo,
  operatorName: string,
  event: "started" | "completed"
) {
  const recipients = await resolveTripAdminRecipients(trip);
  if (!recipients.length) return;

  const tripId = String(trip._id);
  const routeLabel = `${trip.rutaAcubrir} → ${trip.destino}`;
  const isStarted = event === "started";
  const title = isStarted ? "Viaje iniciado" : "Viaje finalizado";
  const body = isStarted
    ? `${operatorName} inició el viaje ${routeLabel}`
    : `${operatorName} finalizó el viaje ${routeLabel}`;
  const type: NotificationType = isStarted ? "trip_started" : "trip_completed";

  await Promise.all(
    recipients.map(async (admin) => {
      const adminId = String(admin._id);
      await notifyUser(adminId, { title, body, type, tripId });

      const email = String((admin as any).email || "").trim();
      if (!email) return;

      const recipientName =
        [admin.nombre, admin.apellido].filter(Boolean).join(" ").trim() || "Administrador";

      try {
        await sendTripStatusEmail({
          to: email,
          recipientName,
          title,
          headline: title,
          detail: body,
        });
      } catch (emailError) {
        console.error(`Error enviando correo a ${email}:`, emailError);
      }
    })
  );
}

export async function notifyAdminsTripStarted(trip: TripNotifyInfo, operatorName: string) {
  await notifyTripCreatorStatus(trip, operatorName, "started");
}

export async function notifyAdminsTripCompleted(trip: TripNotifyInfo, operatorName: string) {
  await notifyTripCreatorStatus(trip, operatorName, "completed");
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

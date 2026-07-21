"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUser = notifyUser;
exports.notifyTripAssigned = notifyTripAssigned;
exports.notifyCompanionAssigned = notifyCompanionAssigned;
exports.notifyAdminsTripCompleted = notifyAdminsTripCompleted;
exports.notifyAnnouncementPublished = notifyAnnouncementPublished;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = __importDefault(require("../models/Notification"));
const User_1 = __importDefault(require("../models/User"));
const pushService_1 = require("./pushService");
async function notifyUser(userId, payload) {
    if (!userId || !mongoose_1.default.Types.ObjectId.isValid(userId))
        return;
    await Notification_1.default.create({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        title: payload.title,
        body: payload.body,
        type: payload.type,
        tripId: payload.tripId ? new mongoose_1.default.Types.ObjectId(String(payload.tripId)) : null,
        read: false,
    });
    const user = await User_1.default.findById(userId).select("expoPushToken");
    if (user?.expoPushToken) {
        await (0, pushService_1.sendPushToToken)(user.expoPushToken, payload.title, payload.body, {
            type: payload.type,
            tripId: payload.tripId ? String(payload.tripId) : "",
        });
    }
}
async function notifyTripAssigned(trip) {
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
async function notifyCompanionAssigned(trip) {
    if (!trip.acompanante || String(trip.acompanante) === "none")
        return;
    const tripId = String(trip._id);
    const routeLabel = `${trip.rutaAcubrir} → ${trip.destino}`;
    await notifyUser(String(trip.acompanante), {
        title: "Vas como acompañante",
        body: `Te asignaron como acompañante en el viaje: ${routeLabel}`,
        type: "companion_assigned",
        tripId,
    });
}
async function notifyAdminsTripCompleted(trip, operatorName) {
    const admins = await User_1.default.find({ rol: "Admin" }).select("_id");
    const tripId = String(trip._id);
    const body = `${operatorName} finalizó el viaje ${trip.rutaAcubrir} → ${trip.destino}`;
    await Promise.all(admins.map((admin) => notifyUser(String(admin._id), {
        title: "Viaje finalizado",
        body,
        type: "trip_completed",
        tripId,
    })));
}
/** Avisa a todos los usuarios (excepto quien publicó) que hay un anuncio nuevo. */
async function notifyAnnouncementPublished(announcement, publisherUserId) {
    const users = await User_1.default.find().select("_id");
    const title = "Nuevo anuncio";
    const preview = String(announcement.contenido || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
    const body = preview
        ? `${announcement.titulo}: ${preview}${preview.length >= 120 ? "…" : ""}`
        : String(announcement.titulo || "Se publicó un aviso nuevo");
    const publisher = publisherUserId ? String(publisherUserId) : "";
    await Promise.all(users
        .filter((u) => String(u._id) !== publisher)
        .map((u) => notifyUser(String(u._id), {
        title,
        body,
        type: "announcement_published",
    })));
}

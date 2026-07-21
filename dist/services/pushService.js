"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToToken = sendPushToToken;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
async function sendPushToToken(token, title, body, data) {
    if (!expo_server_sdk_1.Expo.isExpoPushToken(token)) {
        console.warn("Push token inválido:", token);
        return;
    }
    const message = {
        to: token,
        sound: "default",
        title,
        body,
        data,
    };
    try {
        const chunks = expo.chunkPushNotifications([message]);
        for (const chunk of chunks) {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            console.log("Push enviado:", tickets);
        }
    }
    catch (error) {
        console.error("Error enviando push:", error);
    }
}

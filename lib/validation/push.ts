import { z } from "zod";

/** Body POST /api/push/subscribe. Berasal dari PushSubscription.toJSON() di browser. */
export const subscribeSchema = z.object({
    endpoint: z
        .url({ message: "Endpoint langganan tidak valid." })
        .max(2048, "Endpoint terlalu panjang.")
        .refine((value) => value.startsWith("https://"), "Endpoint harus memakai HTTPS."),
    keys: z.object(
        {
            p256dh: z.string({ error: "Kunci p256dh wajib diisi." }).min(1, "Kunci p256dh wajib diisi.").max(512),
            auth: z.string({ error: "Kunci auth wajib diisi." }).min(1, "Kunci auth wajib diisi.").max(512),
        },
        { error: "Kunci langganan (keys) wajib diisi." }
    ),
});

/** Body DELETE /api/push/subscribe. */
export const unsubscribeSchema = z.object({
    endpoint: z.url({ message: "Endpoint langganan tidak valid." }).max(2048),
});
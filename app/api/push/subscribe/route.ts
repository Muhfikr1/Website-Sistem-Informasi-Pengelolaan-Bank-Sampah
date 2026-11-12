import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, createRateLimitResponse } from "@/lib/ratelimit";
import { apiLogger, startTimer } from "@/lib/logger";
import { subscribeSchema, unsubscribeSchema } from "@/lib/validation/push";

async function readJson(request: NextRequest): Promise<unknown | undefined> {
    try {
        return await request.json();
    } catch {
        return undefined;
    }
}

/**
 * POST /api/push/subscribe
 * Menyimpan (atau memperbarui) langganan Web Push perangkat milik user yang sedang login.
 * Endpoint bersifat unik: jika perangkat yang sama dipakai akun lain, kepemilikannya dipindah.
 */
export async function POST(request: NextRequest) {
    const stop = startTimer();
    const log = apiLogger.child({ operation: "push_subscribe" });

    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
    }

    const rate = checkRateLimit(`push-subscribe:${session.id}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rate.success) {
        log.warn({ userId: session.id, duration_ms: stop() }, "Rate limit terlampaui pada push subscribe");
        return createRateLimitResponse(rate.reset);
    }

    const body = await readJson(request);
    if (body === undefined) {
        return NextResponse.json({ error: "Body permintaan harus berupa JSON." }, { status: 400 });
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Data langganan tidak valid.";
        log.warn({ userId: session.id, message }, "Validasi langganan push gagal");
        return NextResponse.json({ error: message }, { status: 400 });
    }
    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

    try {
        await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: {
                user_id: session.id,
                p256dh_key: keys.p256dh,
                auth_key: keys.auth,
                user_agent: userAgent,
                is_active: true,
            },
            create: {
                user_id: session.id,
                endpoint,
                p256dh_key: keys.p256dh,
                auth_key: keys.auth,
                user_agent: userAgent,
                is_active: true,
            },
        });

        log.info({ userId: session.id, duration_ms: stop() }, "Langganan push tersimpan");
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        log.error({ userId: session.id, err, duration_ms: stop() }, "Gagal menyimpan langganan push");
        return NextResponse.json(
            { error: "Terjadi kesalahan pada server saat menyimpan langganan." },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/push/subscribe
 * Menghapus langganan milik user yang sedang login (saat notifikasi dimatikan).
 */
export async function DELETE(request: NextRequest) {
    const stop = startTimer();
    const log = apiLogger.child({ operation: "push_unsubscribe" });

    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
    }

    const rate = checkRateLimit(`push-subscribe:${session.id}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rate.success) {
        return createRateLimitResponse(rate.reset);
    }

    const body = await readJson(request);
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Data tidak valid.";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
        // Filter user_id: user hanya boleh menghapus langganan miliknya sendiri
        const result = await prisma.pushSubscription.deleteMany({
            where: { endpoint: parsed.data.endpoint, user_id: session.id },
        });
        log.info({ userId: session.id, deleted: result.count, duration_ms: stop() }, "Langganan push dihapus");
        return NextResponse.json({ success: true, deleted: result.count });
    } catch (err) {
        log.error({ userId: session.id, err, duration_ms: stop() }, "Gagal menghapus langganan push");
        return NextResponse.json(
            { error: "Terjadi kesalahan pada server saat menghapus langganan." },
            { status: 500 }
        );
    }
}
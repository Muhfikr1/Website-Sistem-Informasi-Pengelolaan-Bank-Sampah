import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Error khusus ketika saldo nasabah tidak mencukupi untuk mutasi DEBIT.
 */
export class InsufficientBalanceError extends Error {
  readonly balanceBefore: number;
  readonly attemptedAmount: number;

  constructor(
    message: string = "Saldo nasabah tidak mencukupi untuk penarikan ini",
    balanceBefore: number = 0,
    attemptedAmount: number = 0
  ) {
    super(message);
    this.name = "InsufficientBalanceError";
    this.balanceBefore = balanceBefore;
    this.attemptedAmount = attemptedAmount;
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

/**
 * Error khusus ketika user tidak ditemukan saat mutasi saldo.
 */
export class UserNotFoundError extends Error {
  readonly userId: string | number;

  constructor(userId: string | number) {
    super(`User dengan ID ${userId} tidak ditemukan`);
    this.name = "UserNotFoundError";
    this.userId = userId;
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Skema validasi Zod untuk mutasi saldo.
 * Mendukung userId dan referenceId berupa string (UUID) maupun integer positif,
 * serta amount berupa number string atau Prisma.Decimal yang bernilai > 0.
 */
export const balanceMutationInputSchema = z.object({
  userId: z.union([
    z.string().min(1, "userId tidak boleh kosong"),
    z.number().int().positive("userId harus integer positif"),
  ]),
  amount: z
    .union([
      z.number().positive("amount harus bernilai lebih dari 0"),
      z.string().regex(/^\d+(\.\d{1,2})?$/, "amount harus format desimal valid dan bernilai > 0"),
      z.custom<Prisma.Decimal>((val) => val instanceof Prisma.Decimal, {
        message: "amount harus instance Prisma.Decimal",
      }),
    ])
    .refine(
      (val) => {
        try {
          const d = new Prisma.Decimal(val as Prisma.Decimal.Value);
          return d.gt(0);
        } catch {
          return false;
        }
      },
      { message: "amount wajib bernilai lebih dari 0" }
    ),
  mutationType: z.enum(["CREDIT", "DEBIT"], {
    message: "mutationType harus CREDIT atau DEBIT",
  }),
  referenceType: z.enum(["DEPOSIT", "WITHDRAWAL"], {
    message: "referenceType harus DEPOSIT atau WITHDRAWAL",
  }),
  referenceId: z.union([
    z.string().min(1, "referenceId tidak boleh kosong"),
    z.number().int().positive("referenceId harus integer positif"),
  ]),
});

export type BalanceMutationInput = z.infer<typeof balanceMutationInputSchema>;

export interface BalanceMutationResult {
  mutation: {
    id: string;
    userId: string;
    referenceType: string;
    referenceId: string;
    mutationType: "CREDIT" | "DEBIT";
    amount: Prisma.Decimal;
    balanceBefore: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    createdAt: Date;
  };
  balanceBefore: number;
  balanceAfter: number;
}

interface RawUserLockRow {
  id: string;
  balance: Prisma.Decimal | number | string;
}

/**
 * Mencatat mutasi saldo secara terpusat dengan penguncian baris PostgreSQL (FOR UPDATE)
 * guna mencegah race condition.
 *
 * @param tx - Prisma TransactionClient opsional (jika dipanggil dari transaksi luar)
 * @param rawInput - Parameter mutasi saldo
 */
export async function recordBalanceMutation(
  txOrInput: Prisma.TransactionClient | BalanceMutationInput,
  maybeInput?: BalanceMutationInput
): Promise<BalanceMutationResult> {
  // Support overload: recordBalanceMutation(input) atau recordBalanceMutation(tx, input)
  const isFirstParamTx =
    Boolean(txOrInput) &&
    typeof (txOrInput as Record<string, unknown>).$queryRaw === "function";

  const client: Prisma.TransactionClient | null = isFirstParamTx
    ? (txOrInput as Prisma.TransactionClient)
    : null;

  const rawInput: BalanceMutationInput = isFirstParamTx
    ? (maybeInput as BalanceMutationInput)
    : (txOrInput as BalanceMutationInput);

  if (!rawInput) {
    throw new Error("Input mutasi saldo tidak boleh kosong");
  }

  // Validasi lapis 2 runtime dengan Zod
  const validated = balanceMutationInputSchema.parse(rawInput);
  const userIdStr = String(validated.userId);
  const referenceIdStr = String(validated.referenceId);
  const amountDecimal = new Prisma.Decimal(validated.amount as Prisma.Decimal.Value);

  // Fungsi inti mutasi yang berjalan di dalam transaksi
  const executeMutation = async (
    activeTx: Prisma.TransactionClient
  ): Promise<BalanceMutationResult> => {
    const startedAt = performance.now();

    // 1. Raw query row locking PostgreSQL: SELECT FOR UPDATE
    const lockedUsers = await activeTx.$queryRaw<RawUserLockRow[]>`
      SELECT id, balance FROM users WHERE id = ${userIdStr} FOR UPDATE
    `;

    if (!lockedUsers || lockedUsers.length === 0) {
      throw new UserNotFoundError(userIdStr);
    }

    const lockedUser = lockedUsers[0];
    const balanceBeforeDecimal = new Prisma.Decimal(lockedUser.balance as Prisma.Decimal.Value);

    // 2. Hitung balanceAfter & validasi kecukupan saldo jika DEBIT
    let balanceAfterDecimal: Prisma.Decimal;

    if (validated.mutationType === "CREDIT") {
      balanceAfterDecimal = balanceBeforeDecimal.add(amountDecimal);
    } else {
      // DEBIT
      if (balanceBeforeDecimal.lt(amountDecimal)) {
        const durationMs = Math.round(performance.now() - startedAt);
        logger.warn(
          {
            context: "BALANCE_SERVICE",
            userId: userIdStr,
            mutationType: validated.mutationType,
            referenceType: validated.referenceType,
            referenceId: referenceIdStr,
            amount: amountDecimal.toNumber(),
            balanceBefore: balanceBeforeDecimal.toNumber(),
            duration_ms: durationMs,
          },
          "Gagal mutasi saldo: Saldo nasabah tidak mencukupi untuk penarikan ini"
        );
        throw new InsufficientBalanceError(
          "Saldo nasabah tidak mencukupi untuk penarikan ini",
          balanceBeforeDecimal.toNumber(),
          amountDecimal.toNumber()
        );
      }
      balanceAfterDecimal = balanceBeforeDecimal.sub(amountDecimal);
    }

    // 3. Update kolom balance pada tabel users
    await activeTx.user.update({
      where: { id: userIdStr },
      data: {
        balance: balanceAfterDecimal,
      },
    });

    // 4. Buat record baru di tabel balance_mutations
    const createdMutation = await activeTx.balanceMutation.create({
      data: {
        user_id: userIdStr,
        reference_type: validated.referenceType,
        reference_id: referenceIdStr,
        mutation_type: validated.mutationType,
        amount: amountDecimal,
        balance_before: balanceBeforeDecimal,
        balance_after: balanceAfterDecimal,
      },
    });

    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        context: "BALANCE_SERVICE",
        userId: userIdStr,
        mutationType: validated.mutationType,
        referenceType: validated.referenceType,
        referenceId: referenceIdStr,
        amount: amountDecimal.toNumber(),
        balanceBefore: balanceBeforeDecimal.toNumber(),
        balanceAfter: balanceAfterDecimal.toNumber(),
        duration_ms: durationMs,
      },
      `Mutasi saldo ${validated.mutationType} sebesar Rp ${amountDecimal.toFixed(2)} berhasil diproses`
    );

    return {
      mutation: {
        id: createdMutation.id,
        userId: createdMutation.user_id,
        referenceType: createdMutation.reference_type,
        referenceId: createdMutation.reference_id,
        mutationType: createdMutation.mutation_type as "CREDIT" | "DEBIT",
        amount: createdMutation.amount,
        balanceBefore: createdMutation.balance_before,
        balanceAfter: createdMutation.balance_after,
        createdAt: createdMutation.created_at,
      },
      balanceBefore: balanceBeforeDecimal.toNumber(),
      balanceAfter: balanceAfterDecimal.toNumber(),
    };
  };

  // Jika dipanggil di dalam transaksi yang sudah ada, gunakan transaction client tersebut
  if (client) {
    return executeMutation(client);
  }

  // Jika tidak ada transaksi, jalankan transaksi Prisma sendiri
  return defaultPrisma.$transaction(async (newTx) => {
    return executeMutation(newTx);
  });
}

/**
 * Mengambil saldo efektif nasabah:
 * Saldo di tabel users dikurangi total nominal penarikan yang masih berstatus PENDING.
 * Digunakan untuk memvalidasi kelayakan nominal saat pengajuan penarikan baru.
 *
 * @param userId - ID user (string UUID atau number)
 */
export async function getEffectiveBalance(
  userId: string | number
): Promise<{
  currentBalance: number;
  pendingWithdrawals: number;
  effectiveBalance: number;
}> {
  const userIdStr = String(userId);

  const [user, pendingAggregate] = await Promise.all([
    defaultPrisma.user.findUnique({
      where: { id: userIdStr },
      select: { balance: true },
    }),
    defaultPrisma.withdrawal.aggregate({
      where: {
        nasabah_id: userIdStr,
        status: "PENDING",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  if (!user) {
    throw new UserNotFoundError(userIdStr);
  }

  const currentBalance = new Prisma.Decimal(user.balance).toNumber();
  const pendingWithdrawals = pendingAggregate._sum.amount
    ? new Prisma.Decimal(pendingAggregate._sum.amount).toNumber()
    : 0;

  const effectiveBalance = Math.max(0, currentBalance - pendingWithdrawals);

  return {
    currentBalance,
    pendingWithdrawals,
    effectiveBalance,
  };
}

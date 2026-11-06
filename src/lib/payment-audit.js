import PaymentLog from "@/models/PaymentLog";

/**
 * Append audit entries for payment soft-delete / restore operations.
 * Intentionally stores only identifiers and the reason — never payer UPI,
 * email addresses or other personal data.
 */
export async function recordPaymentLogs(action, payments, session, reason = "") {
  if (!Array.isArray(payments) || payments.length === 0) return;

  const adminId = String(session?.user?.id || "");
  const adminDiscordId = String(session?.user?.discordId || "");
  const cleanReason = String(reason || "").trim().slice(0, 500);

  try {
    await PaymentLog.insertMany(
      payments.map((payment) => ({
        paymentId: payment._id,
        utr: String(payment.utr || ""),
        amountPaise: Number(payment.amountPaise || 0),
        action,
        adminId,
        adminDiscordId,
        reason: cleanReason,
      })),
      { ordered: false }
    );
  } catch (err) {
    // Audit failures must not leak sensitive data; log only the error message.
    console.error(
      "Failed to write payment audit log:",
      err?.message || String(err)
    );
  }
}

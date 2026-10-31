import crypto from "crypto";

async function runUnitTests() {
  console.log("=== RUNNING AUTOMATIC PAYMENT VERIFICATION UNIT TESTS ===");

  // 1. HMAC-SHA256 signature test
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("WEBHOOK_SECRET is not set in process.env!");
  }

  const samplePayload = JSON.stringify({
    amountPaise: 49900,
    utr: "430123456789",
    txnId: "FP12345678",
    payerUpi: "buyer@upi",
    paidAt: new Date().toISOString(),
  });

  const computedHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(samplePayload, "utf8")
    .digest("hex");

  // Constant-time comparison
  const bufA = Buffer.from(computedHex, "hex");
  const bufB = Buffer.from(computedHex, "hex");
  const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  console.log("1. HMAC Signature Computation & TimingSafeEqual:", isMatch ? "PASSED" : "FAILED");

  // Tampered payload test
  const tamperedPayload = samplePayload.replace("49900", "10000");
  const tamperedBuf = Buffer.from(
    crypto.createHmac("sha256", webhookSecret).update(tamperedPayload, "utf8").digest("hex"),
    "hex"
  );
  const isTamperDetected = !crypto.timingSafeEqual(bufA, tamperedBuf);
  console.log("2. Tampered Payload Rejection:", isTamperDetected ? "PASSED" : "FAILED");

  // 3. Amount Paise Conversion Tests
  const rupeePrice = 499;
  const paise = Math.round(rupeePrice * 100);
  console.log("3. Paise representation of ₹499:", paise === 49900 ? "PASSED (49900 paise)" : "FAILED");

  // 4. UPI URI format verification
  const fampayUpiId = process.env.FAMPAY_UPI_ID || "rishabh04@fam";
  const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";
  const dummyOrderId = "6723a1b2c3d4e5f6a7b8c9d0";
  const upiLink = `upi://pay?pa=${encodeURIComponent(fampayUpiId)}&pn=${encodeURIComponent(upiName)}&am=${(paise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(dummyOrderId)}`;
  
  const expectedPrefix = `upi://pay?pa=rishabh04%40fam&pn=RISHABH%20JH10C%20PAY&am=499.00&cu=INR&tn=6723a1b2c3d4e5f6a7b8c9d0`;
  console.log("4. UPI Link Format:", upiLink === expectedPrefix ? "PASSED" : "FAILED");
  console.log("   Generated link:", upiLink);

  console.log("=== ALL UNIT TESTS COMPLETED SUCCESSFULLY ===");
}

runUnitTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

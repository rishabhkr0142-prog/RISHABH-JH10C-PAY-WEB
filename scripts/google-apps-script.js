/**
 * ==============================================================================
 * RISHABH JH10C PAY WEB — Google Apps Script for FamPay UPI Webhook Forwarding
 * ==============================================================================
 *
 * HOW IT WORKS:
 * 1. Runs every 1 minute via a Google Apps Script time-driven trigger.
 * 2. Searches Gmail for new, unprocessed FamPay credit alert emails.
 * 3. Extracts amount, 12-digit UTR, transaction ID, and timestamp.
 * 4. Converts amount into integer paise (₹199 -> 19900).
 * 5. Computes HMAC-SHA256 signature using WEBHOOK_SECRET.
 * 6. Sends a secure POST request to your site: https://<your-domain>/api/pay/webhook
 * 7. Applies the label "FamPay_Processed" to each processed email thread so
 *    it is NEVER processed twice.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets or visit https://script.google.com
 * 2. Click "New Project" and paste this entire code into `Code.gs`.
 * 3. Update WEBHOOK_URL with your Vercel production domain (or ngrok URL for local dev).
 * 4. Ensure WEBHOOK_SECRET matches the one in your .env / Vercel Environment Variables.
 * 5. Click the "Triggers" clock icon on the left menu -> "+ Add Trigger":
 *    - Function to run: `processFamPayEmails`
 *    - Event source: `Time-driven`
 *    - Type: `Minutes timer`
 *    - Interval: `Every minute`
 * 6. Save and authorize permissions when prompted.
 * ==============================================================================
 */

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
var CONFIG = {
  // Your deployed Next.js site URL
  WEBHOOK_URL: "https://rishabh-jh10c-pay-web.vercel.app/api/pay/webhook",

  // Must match WEBHOOK_SECRET in your .env and Vercel dashboard
  WEBHOOK_SECRET: "9f8c4e6b2a1d0f5e7c8b3a4d6f1e2c3b4a5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",

  // Gmail search query to locate incoming FamPay credit alert emails
  GMAIL_QUERY: 'from:(alerts@fampay.in OR support@fampay.in OR notifications@famapp.in OR fampay) "credited" -label:FamPay_Processed',

  // Gmail label applied to threads once webhook succeeds
  PROCESSED_LABEL: "FamPay_Processed",

  // Maximum number of threads to process in a single 1-minute execution
  BATCH_SIZE: 15,
};

/**
 * Main cron function scheduled to run every 1 minute.
 */
function processFamPayEmails() {
  var label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, CONFIG.BATCH_SIZE);

  if (threads.length === 0) {
    Logger.log("No new FamPay payment emails found.");
    return;
  }

  Logger.log("Found " + threads.length + " candidate email thread(s).");

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      var body = message.getPlainBody() || message.getBody();
      var subject = message.getSubject();
      var messageDate = message.getDate();

      Logger.log("Parsing email: " + subject + " (" + messageDate + ")");

      var paymentData = extractFamPayDetails(subject, body, messageDate);

      if (paymentData && paymentData.utr && paymentData.amountPaise > 0) {
        Logger.log("Extracted Payment: UTR=" + paymentData.utr + ", Amount=" + (paymentData.amountPaise / 100) + " INR");

        var success = sendWebhook(paymentData);
        if (success) {
          thread.addLabel(label);
          Logger.log("Successfully forwarded and labeled thread: " + thread.getId());
        } else {
          Logger.log("Failed to send webhook for UTR: " + paymentData.utr);
        }
      } else {
        Logger.log("Could not extract valid UPI payment details from message: " + subject);
      }
    }
  }
}

/**
 * Extracts payment details (amount, UTR, txnId, payer UPI) using regular expressions.
 */
function extractFamPayDetails(subject, body, messageDate) {
  var fullText = (subject + "\n" + body).replace(/&nbsp;/g, " ");

  // 1. Extract Amount in Rupees (e.g. "Rs. 199", "Rs 199.00", "₹199", "credited with INR 199")
  var amount = 0;
  var amountRegex = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
  var amountMatch = fullText.match(amountRegex);

  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  // 2. Extract 12-Digit UPI UTR / RRN (e.g. "UPI Ref: 430123456789", "UTR: 430123456789", "Ref no: 430123456789")
  var utr = "";
  var utrRegex = /(?:UTR|UPI\s*Ref(?:\s*No)?|Reference\s*No|RRN|Ref\s*ID)[:\s#]*(\d{12})/i;
  var utrMatch = fullText.match(utrRegex);

  if (utrMatch && utrMatch[1]) {
    utr = utrMatch[1];
  } else {
    // Fallback: search for any standalone 12-digit number preceded by common transaction words
    var generic12DigitMatch = fullText.match(/(?:transaction|payment|ref|credited)[^\d]{0,40}(\d{12})/i);
    if (generic12DigitMatch && generic12DigitMatch[1]) {
      utr = generic12DigitMatch[1];
    }
  }

  // 3. Extract Internal Transaction / Reference ID (if present)
  var txnId = "";
  var txnRegex = /(?:Txn(?:\s*ID)?|Transaction\s*ID)[:\s#]*([A-Za-z0-9_-]{6,30})/i;
  var txnMatch = fullText.match(txnRegex);
  if (txnMatch && txnMatch[1]) {
    txnId = txnMatch[1];
  }

  // 4. Extract Payer UPI ID / VPA (e.g. "from sender@okaxis", "by buyer@paytm")
  var payerUpi = "";
  var upiVpaRegex = /[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,}/i;
  var vpaMatch = fullText.match(upiVpaRegex);
  if (vpaMatch && vpaMatch[0]) {
    payerUpi = vpaMatch[0];
  }

  if (!utr || amount <= 0) {
    return null;
  }

  return {
    amountPaise: Math.round(amount * 100), // Integer paise representation
    utr: String(utr).trim(),
    txnId: String(txnId || "").trim(),
    payerUpi: String(payerUpi || "").trim(),
    paidAt: messageDate ? messageDate.toISOString() : new Date().toISOString(),
  };
}

/**
 * Computes constant-time HMAC-SHA256 signature and POSTs JSON to /api/pay/webhook.
 */
function sendWebhook(payload) {
  var rawJson = JSON.stringify(payload);
  var signatureHex = computeHmacSha256Hex(rawJson, CONFIG.WEBHOOK_SECRET);

  var options = {
    method: "post",
    contentType: "application/json",
    payload: rawJson,
    headers: {
      "x-signature": signatureHex,
      "User-Agent": "FamPay-GoogleAppsScript-Webhook/1.0",
    },
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log("Webhook Response (" + statusCode + "): " + responseText);

    if (statusCode === 200 || statusCode === 201) {
      return true;
    } else {
      Logger.log("Webhook failed with status " + statusCode + ": " + responseText);
      return false;
    }
  } catch (err) {
    Logger.log("UrlFetchApp exception: " + err.toString());
    return false;
  }
}

/**
 * Helper: Computes HMAC-SHA256 hex string in Google Apps Script.
 */
function computeHmacSha256Hex(message, secret) {
  var rawSignature = Utilities.computeHmacSha256Signature(message, secret);
  var hex = "";
  for (var i = 0; i < rawSignature.length; i++) {
    var byteVal = rawSignature[i];
    if (byteVal < 0) {
      byteVal += 256;
    }
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) {
      byteHex = "0" + byteHex;
    }
    hex += byteHex;
  }
  return hex;
}

/**
 * Helper: Finds or creates a Gmail label safely.
 */
function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

/**
 * Test function to verify webhook connection and HMAC signature from Google Apps Script editor.
 * Run this function once manually by clicking "Run" in the GAS toolbar to test!
 */
function testWebhookConnection() {
  Logger.log("Testing webhook connection to: " + CONFIG.WEBHOOK_URL);

  var testPayload = {
    amountPaise: 10000, // Rs 100.00
    utr: "9999" + Math.floor(10000000 + Math.random() * 90000000), // Random 12-digit UTR
    txnId: "TEST-" + Utilities.getUuid().slice(0, 8),
    payerUpi: "testpayer@upi",
    paidAt: new Date().toISOString(),
  };

  var ok = sendWebhook(testPayload);
  if (ok) {
    Logger.log("SUCCESS! Webhook responded with 200 OK.");
  } else {
    Logger.log("FAILED! Check your WEBHOOK_URL and WEBHOOK_SECRET.");
  }
}


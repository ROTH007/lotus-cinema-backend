/*
 * KHQR generator — Lotus Cinema
 * ------------------------------------------------------------
 * Builds a Cambodia KHQR payment string following the EMVCo
 * merchant-presented QR spec (the same TLV format Bakong / ACLEDA
 * use). A bank app that supports KHQR will scan this and read the
 * merchant name and the exact amount.
 *
 * NOTE: this uses a demo/static merchant account number. The QR is
 * FORMAT-VALID and scannable, but no real money moves — flip in a
 * real Bakong account number + a real acquirer to make it live.
 *
 * TLV = Tag (2 digits) + Length (2 digits) + Value.
 * The whole string ends with tag 63 = CRC16-CCITT (0x1021, init 0xFFFF).
 */

// One TLV field: "ID" + 2-digit length + value
function field(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (False) — polynomial 0x1021, init 0xFFFF
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Build a KHQR string.
 * @param {object} o
 * @param {number} o.amount        e.g. 18.40
 * @param {string} [o.currency]    'USD' or 'KHR'   (default USD)
 * @param {string} [o.merchant]    merchant name shown in the app
 * @param {string} [o.city]        merchant city
 * @param {string} [o.account]     Bakong account id (demo default)
 * @param {string} [o.billNumber]  reference shown to the payer (booking ref)
 */
function buildKHQR({
  amount,
  currency = "USD",
  merchant = "LOTUS CINEMA",
  city = "PHNOM PENH",
  account = "lotus_cinema@aclb", // demo Bakong-style account id
  billNumber,
} = {}) {
  // ISO 4217 numeric currency codes
  const CUR = { USD: "840", KHR: "116" };
  const cur = CUR[currency] || CUR.USD;

  // amount: KHR has no decimals, USD keeps 2
  const amt = currency === "KHR" ? String(Math.round(amount)) : amount.toFixed(2);

  // 00 – payload format indicator
  let s = field("00", "01");
  // 01 – point of initiation: 12 = dynamic (amount included, one-time)
  s += field("01", "12");

  // 29 – merchant account information (Bakong template)
  //   00 = acquirer/bakong id, 01 = merchant account id
  const merchantAccount = field("00", "khqr@bakong") + field("01", account);
  s += field("29", merchantAccount);

  // 52 – merchant category code (5815 = digital goods / entertainment-ish; 7832 = cinemas)
  s += field("52", "7832");
  // 53 – transaction currency
  s += field("53", cur);
  // 54 – transaction amount
  s += field("54", amt);
  // 58 – country code
  s += field("58", "KH");
  // 59 – merchant name
  s += field("59", merchant.slice(0, 25));
  // 60 – merchant city
  s += field("60", city.slice(0, 15));

  // 62 – additional data (01 = bill number / reference)
  if (billNumber) {
    s += field("62", field("01", String(billNumber).slice(0, 25)));
  }

  // 63 – CRC. The 4 hex digits are computed over everything INCLUDING "6304"
  s += "6304";
  s += crc16(s);

  return s;
}

module.exports = { buildKHQR, crc16 };

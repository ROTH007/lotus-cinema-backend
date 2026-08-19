/*
 * ACLEDA XPay (sandbox) integration
 * ------------------------------------------------------------
 * Flow, per ACLEDA's docs:
 *   1. POST /hashing        -> returns a `hash` for the transaction
 *   2. POST /openSessionV2  -> returns sessionid + paymentTokenid
 *   3. Build an HTML form and POST it to paymentPage.jsp
 *      -> ACLEDA renders the real KHQR page the customer scans
 *   4. POST /getTranStatus  -> poll to see whether it was paid
 *
 * Everything lives in .env so no credentials sit in the repo:
 *   ACLEDA_ENABLED=true
 *   ACLEDA_BASE=https://epaymentuat.acledabank.com.kh
 *   ACLEDA_PATH=XPAYTEST2024
 *   ACLEDA_LOGIN=xpaytest2024
 *   ACLEDA_PASSWORD=xpaytest2024
 *   ACLEDA_MERCHANT_ID=v4uFDbZKlJ1Dyf7dq7MfpTmpYKU=
 *   ACLEDA_SECRET=xxx
 *   ACLEDA_APIKEY=<the X-Api-Key from the portal>
 *   USD_TO_KHR=4100
 *
 * If ACLEDA_ENABLED is not "true", the caller falls back to the
 * locally generated KHQR string — so the demo still works offline.
 */

const enabled = () => process.env.ACLEDA_ENABLED === 'true';

const cfg = () => ({
  base: process.env.ACLEDA_BASE || 'https://epaymentuat.acledabank.com.kh',
  path: process.env.ACLEDA_PATH || 'XPAYTEST2024',
  login: process.env.ACLEDA_LOGIN,
  password: process.env.ACLEDA_PASSWORD,
  merchantId: process.env.ACLEDA_MERCHANT_ID,
  secret: process.env.ACLEDA_SECRET,
  apiKey: process.env.ACLEDA_APIKEY,
  rate: Number(process.env.USD_TO_KHR || 4100),
});

/* txid format seen in ACLEDA's examples: YYMMDDHHMMSSmmm */
function makeTxid() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    p(d.getFullYear() % 100) +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds()) +
    p(d.getMilliseconds(), 3)
  );
}

/* USD -> KHR, rounded to the nearest 100 riel like real merchants do */
function usdToKhr(usd) {
  const { rate } = cfg();
  return Math.round((usd * rate) / 100) * 100;
}

async function post(url, body) {
  const c = cfg();
  const headers = { 'Content-Type': 'application/json' };
  if (c.apiKey) headers['X-Api-Key'] = c.apiKey;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`ACLEDA ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/* ---- step 1: hashing ---- */
async function getHash(txid) {
  const c = cfg();
  const url = `${c.base}/${c.path}/XPAYConnectorServiceInterfaceImplV2/XPAYConnectorServiceInterfaceImplV2RS/hashing`;
  const out = await post(url, {
    loginId: c.login,
    password: c.password,
    merchantID: c.merchantId,
    txid,
    secret: c.secret,
  });
  // the portal returns the hash as a bare string or under a field
  return typeof out === 'string' ? out : out.hash || out.result || out.data || out.raw;
}

/* ---- step 2: open session ---- */
async function openSession({ txid, hash, amountKhr, description, invoiceId }) {
  const c = cfg();
  const url = `${c.base}/${c.path}/XPAYConnectorServiceInterfaceImplV2/XPAYConnectorServiceInterfaceImplV2RS/openSessionV2`;
  const now = new Date();
  const purchaseDate = `${String(now.getDate()).padStart(2, '0')}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}-${now.getFullYear()}`;

  const out = await post(url, {
    loginId: c.login,
    password: c.password,
    merchantID: c.merchantId,
    hash,
    xpayTransaction: {
      txid,
      purchaseAmount: String(amountKhr),
      purchaseCurrency: 'KHR',
      purchaseDate,
      purchaseDesc: description || 'Lotus Cinema ticket',
      invoiceid: invoiceId || txid,
      item: '1',
      quantity: '1',
      expiryTime: '5',
      operationType: '3', // 3 = KHQR
    },
  });

  const r = out.result || out;
  if (r.code !== undefined && Number(r.code) !== 0) {
    throw new Error(`ACLEDA openSession failed: ${r.errorDetails || JSON.stringify(r)}`);
  }
  return {
    sessionId: r.sessionid || r.sessionId,
    paymentTokenId: r.xTran?.paymentTokenid || r.paymentTokenid,
    amountKhr: r.xTran?.purchaseAmount ?? amountKhr,
    raw: out,
  };
}

/* ---- step 3: the URL/fields the browser must POST to ---- */
function paymentPage({ sessionId, paymentTokenId, amountKhr, txid, description }) {
  const c = cfg();
  return {
    action: `${c.base}/${c.path}/paymentPage.jsp`,
    fields: {
      merchantID: c.merchantId,
      description: description || 'Lotus Cinema ticket',
      expirytime: '5',
      quantity: '1',
      item: '1',
      operationType: '3',
      sessionid: sessionId,
      paymenttokenid: paymentTokenId,
      amount: String(amountKhr),
      invoiceid: txid,
      transactionID: txid,
      currencytype: 'KHR',
    },
  };
}

/* ---- step 4: poll payment status ---- */
async function getStatus(txid) {
  const c = cfg();
  const hash = await getHash(txid);
  const url = `${c.base}/${c.path}/XPAYConnectorServiceInterfaceImplV2/XPAYConnectorServiceInterfaceImplV2RS/getTranStatus`;
  const out = await post(url, {
    loginId: c.login,
    password: c.password,
    merchantID: c.merchantId,
    hash,
    txid,
  });
  const r = out.result || out;
  return {
    code: r.code,
    status: r.tranStatus || r.status || r.errorDetails,
    paid: String(r.tranStatus || '').toUpperCase() === 'SUCCESS' || Number(r.code) === 0,
    raw: out,
  };
}

/* ---- one call that does steps 1-3 ---- */
async function createPayment({ amountUsd, description, invoiceId }) {
  const txid = makeTxid();
  const amountKhr = usdToKhr(amountUsd);
  const hash = await getHash(txid);
  const session = await openSession({ txid, hash, amountKhr, description, invoiceId });
  const form = paymentPage({
    sessionId: session.sessionId,
    paymentTokenId: session.paymentTokenId,
    amountKhr,
    txid,
    description,
  });
  return { txid, amountKhr, amountUsd, ...form };
}

module.exports = {
  enabled,
  makeTxid,
  usdToKhr,
  getHash,
  openSession,
  paymentPage,
  getStatus,
  createPayment,
};
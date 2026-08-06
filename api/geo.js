// Returns the visitor's currency (from their country) + the USD→currency exchange rate,
// so the store can show a local-currency estimate next to the USD price it actually charges.
const COUNTRY_CURRENCY = {
  US: "USD", CA: "CAD", HT: "USD", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  IE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK",
  DK: "DKK", PL: "PLN", MX: "MXN", BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN", DO: "DOP",
  JM: "JMD", TT: "TTD", AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY", IN: "INR", ZA: "ZAR", NG: "NGN",
  AE: "AED", SA: "SAR", TR: "TRY", KR: "KRW", SG: "SGD", HK: "HKD", PH: "PHP", TH: "THB", MY: "MYR",
  ID: "IDR", VN: "VND", IL: "ILS", MA: "MAD", EG: "EGP", KE: "KES", GH: "GHS",
};
const SYMBOL = {
  USD: "$", CAD: "CA$", EUR: "€", GBP: "£", CHF: "CHF ", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł",
  MXN: "MX$", BRL: "R$", ARS: "AR$", COP: "COL$", CLP: "CLP$", PEN: "S/", DOP: "RD$", JMD: "J$",
  TTD: "TT$", AUD: "A$", NZD: "NZ$", JPY: "¥", CNY: "CN¥", INR: "₹", ZAR: "R", NGN: "₦", AED: "AED ",
  SAR: "SAR ", TRY: "₺", KRW: "₩", SGD: "S$", HKD: "HK$", PHP: "₱", THB: "฿", MYR: "RM", IDR: "Rp",
  VND: "₫", ILS: "₪", MAD: "MAD ", EGP: "E£", KES: "KSh", GHS: "GH₵",
};

export default async function handler(req, res) {
  const country = String(req.headers["x-vercel-ip-country"] || "US").toUpperCase();
  const currency = COUNTRY_CURRENCY[country] || "USD";
  let rate = 1;
  if (currency !== "USD") {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const d = await r.json();
      if (d && d.rates && d.rates[currency]) rate = d.rates[currency];
    } catch { /* fall back to USD-only */ }
  }
  // Per-country response — don't share one country's result across the edge cache.
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).json({ country, currency, symbol: SYMBOL[currency] || `${currency} `, rate });
}

// netlify/functions/track.js
// Terima event dari tombol CTA (client), forward ke Meta Conversions API
// dan/atau TikTok Events API pakai access token yang disimpan di Environment
// Variables Netlify (bukan di file config yang ke-commit ke Git).
//
// Env vars yang perlu di-set di Netlify (Site settings > Environment variables):
//   META_ACCESS_TOKEN   -> token CAPI dari Meta Events Manager
//   TIKTOK_ACCESS_TOKEN -> token Events API dari TikTok Ads Manager

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const {
    event: eventName,
    event_id: eventId,
    value,
    currency,
    page_url: pageUrl,
    meta_pixel_id: metaPixelId,
    tiktok_pixel_id: tiktokPixelId,
  } = payload;

  if (!eventName || !eventId) {
    return { statusCode: 400, body: "Missing event or event_id" };
  }

  const clientIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    "";
  const userAgent = event.headers["user-agent"] || "";

  const results = {};

  // ---- Kirim ke Meta Conversions API ----
  if (metaPixelId && process.env.META_ACCESS_TOKEN) {
    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${metaPixelId}/events?access_token=${process.env.META_ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [
              {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId, // sama dengan eventID di pixel client -> dedup
                event_source_url: pageUrl,
                action_source: "website",
                user_data: {
                  client_ip_address: clientIp,
                  client_user_agent: userAgent,
                },
                custom_data: {
                  value: value || 0,
                  currency: currency || "IDR",
                },
              },
            ],
          }),
        }
      );
      results.meta = await metaRes.json();
    } catch (err) {
      results.meta = { error: err.message };
    }
  }

  // ---- Kirim ke TikTok Events API ----
  if (tiktokPixelId && process.env.TIKTOK_ACCESS_TOKEN) {
    try {
      const ttRes = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": process.env.TIKTOK_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          pixel_code: tiktokPixelId,
          event: eventName,
          event_id: eventId, // sama dengan event_id di ttq.track -> dedup
          timestamp: new Date().toISOString(),
          context: {
            page: { url: pageUrl },
            user_agent: userAgent,
            ip: clientIp,
          },
          properties: {
            value: value || 0,
            currency: currency || "IDR",
          },
        }),
      });
      results.tiktok = await ttRes.json();
    } catch (err) {
      results.tiktok = { error: err.message };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, results }),
  };
};

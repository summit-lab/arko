/**
 * Script one-shot: genera auto_title para todos los reels sin título.
 * Usa Gemini Flash + caption como input.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node scripts/generate-reel-titles.mjs
 *
 * O crear un .env.local y cargarlo manualmente antes de correr.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_KEY) {
  console.error("Error: faltan variables de entorno. Requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY");
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
const BATCH_SIZE = 5;

async function getReelsWithoutTitle() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reels?select=id,caption&auto_title=is.null&caption=not.is.null&limit=200`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  );
  return res.json();
}

async function generateTitle(caption) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Eres un asistente que genera títulos internos para Instagram Reels. REGLAS: máximo 60 caracteres, sin hashtags, sin emojis, sin CTAs como "comentá" o "guardá", sin puntos finales, sin comillas. Responde ÚNICAMENTE con el título, nada más.\n\nBasándote en este caption de un Instagram Reel, generá un título descriptivo del TEMA CENTRAL del video. NO copies el caption, NO uses CTAs.\n\nCaption: ${caption.slice(0, 300)}`
        }]
      }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "").replace(/#\w+/g, "").trim().slice(0, 60);
}

async function updateTitle(id, auto_title) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/reels?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ auto_title })
    }
  );
}

async function main() {
  console.log("Obteniendo reels sin título...");
  const reels = await getReelsWithoutTitle();
  console.log(`${reels.length} reels para procesar.`);

  let ok = 0, fail = 0;

  for (let i = 0; i < reels.length; i += BATCH_SIZE) {
    const batch = reels.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (r) => {
      try {
        const title = await generateTitle(r.caption);
        if (title.length > 3) {
          await updateTitle(r.id, title);
          console.log(`✓ [${ok + 1}/${reels.length}] ${title}`);
          ok++;
        } else {
          fail++;
        }
      } catch (e) {
        console.error(`✗ ${r.id}: ${e.message}`);
        fail++;
      }
    }));
    if (i + BATCH_SIZE < reels.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nListo: ${ok} generados, ${fail} fallidos.`);
}

main().catch(console.error);

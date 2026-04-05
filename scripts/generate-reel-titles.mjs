/**
 * Script one-shot: genera auto_title para todos los reels sin título.
 * Usa Gemini Flash + caption como input. Corre: node scripts/generate-reel-titles.mjs
 */

const SUPABASE_URL = "https://hrsvglgswatwklivkoyp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZnbGdzd2F0d2tsaXZrb3lwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4MTY1OCwiZXhwIjoyMDg5ODU3NjU4fQ.XJIzfhuv3IxdAagcpvtdciGRrsZsLpffvQ8_IpPT6FM";
const GEMINI_KEY = "AIzaSyBd4MBk0DFEA7E3Sr7Jo5uvSXUwICy3hXs";
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
    // Pequeña pausa entre batches
    if (i + BATCH_SIZE < reels.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nListo: ${ok} generados, ${fail} fallidos.`);
}

main().catch(console.error);

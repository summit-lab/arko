/**
 * Script para hacer llamadas de prueba a la API de Meta
 * y completar los tests requeridos para el App Review.
 *
 * Uso: npx tsx scripts/meta-api-test.ts <ACCESS_TOKEN>
 *
 * El access token se genera desde Graph API Explorer:
 * https://developers.facebook.com/tools/explorer/
 */

const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('\n❌ Falta el access token.');
  console.error('Uso: npx tsx scripts/meta-api-test.ts <ACCESS_TOKEN>\n');
  console.error('Generá el token desde: https://developers.facebook.com/tools/explorer/');
  console.error('Seleccioná la app "arko" y pedí todos los permisos.\n');
  process.exit(1);
}

const API_BASE = 'https://graph.facebook.com/v25.0';

interface TestResult {
  permission: string;
  endpoint: string;
  status: 'OK' | 'ERROR';
  data?: string;
  error?: string;
}

const results: TestResult[] = [];

async function callMeta(permission: string, endpoint: string, params: string = ''): Promise<unknown> {
  const url = `${API_BASE}${endpoint}?access_token=${ACCESS_TOKEN}${params ? '&' + params : ''}`;
  const displayUrl = `${API_BASE}${endpoint}${params ? '?' + params : ''}`;

  try {
    const res = await fetch(url);
    const json = await res.json() as Record<string, unknown>;

    if (json.error) {
      const err = json.error as Record<string, unknown>;
      console.log(`  ❌ ${permission} — ${displayUrl}`);
      console.log(`     Error: ${err.message}\n`);
      results.push({ permission, endpoint: displayUrl, status: 'ERROR', error: String(err.message) });
      return null;
    }

    const preview = JSON.stringify(json).slice(0, 120);
    console.log(`  ✅ ${permission} — ${displayUrl}`);
    console.log(`     ${preview}...\n`);
    results.push({ permission, endpoint: displayUrl, status: 'OK', data: preview });
    return json;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ ${permission} — ${displayUrl}`);
    console.log(`     Fetch error: ${msg}\n`);
    results.push({ permission, endpoint: displayUrl, status: 'ERROR', error: msg });
    return null;
  }
}

async function main() {
  console.log('\n🚀 Ejecutando llamadas de prueba a la API de Meta...\n');
  console.log('═'.repeat(60));

  // 1. public_profile
  console.log('\n📋 public_profile\n');
  const me = await callMeta('public_profile', '/me', 'fields=id,name,email') as Record<string, unknown> | null;

  // 2. pages_show_list + pages_read_engagement
  console.log('📋 pages_show_list + pages_read_engagement\n');
  const pages = await callMeta('pages_show_list', '/me/accounts', 'fields=id,name,access_token,instagram_business_account') as Record<string, unknown> | null;

  let pageId: string | null = null;
  let pageToken: string | null = null;
  let igAccountId: string | null = null;

  if (pages) {
    const pagesData = pages.data as Array<Record<string, unknown>> | undefined;
    if (pagesData && pagesData.length > 0) {
      const firstPage = pagesData[0];
      pageId = firstPage.id as string;
      pageToken = firstPage.access_token as string;
      const igBiz = firstPage.instagram_business_account as Record<string, unknown> | undefined;
      if (igBiz) {
        igAccountId = igBiz.id as string;
      }
      console.log(`  📌 Page encontrada: ${firstPage.name} (${pageId})`);
      if (igAccountId) console.log(`  📌 IG Business Account: ${igAccountId}`);
      console.log('');

      // pages_read_engagement — leer info de la página
      await callMeta('pages_read_engagement', `/${pageId}`, `fields=id,name,fan_count,followers_count&access_token=${pageToken}`);
    }
  }

  // 3. business_management
  console.log('📋 business_management\n');
  await callMeta('business_management', '/me/businesses', 'fields=id,name');

  // 4. ads_read + ads_management
  console.log('📋 ads_read + Ads Management Standard Access\n');
  const adAccounts = await callMeta('ads_read', '/me/adaccounts', 'fields=id,name,account_status,currency') as Record<string, unknown> | null;

  if (adAccounts) {
    const adData = adAccounts.data as Array<Record<string, unknown>> | undefined;
    if (adData && adData.length > 0) {
      const adAccountId = adData[0].id as string; // ya viene como "act_XXX"
      console.log(`  📌 Ad Account: ${adData[0].name} (${adAccountId})\n`);

      await callMeta('ads_read', `/${adAccountId}/campaigns`, 'fields=id,name,status,objective&limit=3');
      await callMeta('ads_read', `/${adAccountId}/adsets`, 'fields=id,name,status&limit=3');
      await callMeta('ads_read', `/${adAccountId}/ads`, 'fields=id,name,status,creative&limit=3');
      await callMeta('ads_management', `/${adAccountId}/insights`, 'fields=impressions,clicks,spend,cpc,cpm&date_preset=last_30d');
    }
  }

  // 5. instagram_basic + instagram_business_basic
  if (igAccountId) {
    console.log('📋 instagram_basic\n');
    await callMeta('instagram_basic', `/${igAccountId}`, 'fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography');

    const media = await callMeta('instagram_basic', `/${igAccountId}/media`, 'fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=5') as Record<string, unknown> | null;

    // instagram_business_basic (mismas queries que instagram_basic, Meta las cuenta para este permiso)
    console.log('📋 instagram_business_basic\n');
    await callMeta('instagram_business_basic', `/${igAccountId}`, 'fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count');

    // 6. instagram_manage_insights
    console.log('📋 instagram_manage_insights\n');
    await callMeta('instagram_manage_insights', `/${igAccountId}/insights`, 'metric=reach,follower_count&period=day&since=' + getDateDaysAgo(7) + '&until=' + getDateDaysAgo(0));
    await callMeta('instagram_manage_insights', `/${igAccountId}/insights`, 'metric=profile_views,accounts_engaged,total_interactions&period=day&metric_type=total_value&since=' + getDateDaysAgo(7) + '&until=' + getDateDaysAgo(0));
    await callMeta('instagram_manage_insights', `/${igAccountId}/insights`, 'metric=follower_count&period=day&since=' + getDateDaysAgo(7) + '&until=' + getDateDaysAgo(0));

    // 7. instagram_business_manage_insights
    console.log('📋 instagram_business_manage_insights\n');
    await callMeta('instagram_business_manage_insights', `/${igAccountId}/insights`, 'metric=reach&period=day&since=' + getDateDaysAgo(7) + '&until=' + getDateDaysAgo(0));
    await callMeta('instagram_business_manage_insights', `/${igAccountId}/insights`, 'metric=total_interactions,accounts_engaged&period=day&metric_type=total_value&since=' + getDateDaysAgo(7) + '&until=' + getDateDaysAgo(0));

    let firstMediaId: string | null = null;

    if (media) {
      const mediaData = media.data as Array<Record<string, unknown>> | undefined;
      if (mediaData && mediaData.length > 0) {
        firstMediaId = mediaData[0].id as string;
        const mediaType = mediaData[0].media_type as string;
        console.log(`  📌 Media: ${firstMediaId} (${mediaType})\n`);

        if (mediaType === 'VIDEO') {
          await callMeta('instagram_manage_insights', `/${firstMediaId}/insights`, 'metric=views,reach,saved,likes,comments,shares,total_interactions');
        } else {
          await callMeta('instagram_manage_insights', `/${firstMediaId}/insights`, 'metric=reach,saved,likes,comments,shares,total_interactions');
        }
      }
    }

    // 8. instagram_manage_comments + instagram_business_manage_comments
    if (firstMediaId) {
      console.log('📋 instagram_manage_comments\n');
      await callMeta('instagram_manage_comments', `/${firstMediaId}/comments`, 'fields=id,text,timestamp,username');

      console.log('📋 instagram_business_manage_comments\n');
      await callMeta('instagram_business_manage_comments', `/${firstMediaId}/comments`, 'fields=id,text,timestamp,username');
    }

    // 9. instagram_content_publish (solo lectura — listar contenedor de media)
    console.log('📋 instagram_content_publish\n');
    await callMeta('instagram_content_publish', `/${igAccountId}/content_publishing_limit`, `fields=quota_usage&access_token=${pageToken}`);

    // 10. instagram_business_manage_messages
    console.log('📋 instagram_business_manage_messages\n');
    await callMeta('instagram_business_manage_messages', `/${pageId}/conversations`, `fields=id,participants,updated_time&platform=instagram&access_token=${pageToken}`);

    // 11. public_profile (extra call)
    console.log('📋 public_profile (extra)\n');
    await callMeta('public_profile', '/me', 'fields=id,name');

    // 12. pages_show_list (extra call)
    console.log('📋 pages_show_list (extra)\n');
    await callMeta('pages_show_list', '/me/accounts', 'fields=id,name');

  } else {
    console.log('⚠️  No se encontró Instagram Business Account. Saltando tests de IG.\n');
  }

  // Resumen
  console.log('═'.repeat(60));
  console.log('\n📊 RESUMEN\n');

  const ok = results.filter(r => r.status === 'OK');
  const errors = results.filter(r => r.status === 'ERROR');

  console.log(`  ✅ Exitosas: ${ok.length}`);
  console.log(`  ❌ Fallidas: ${errors.length}`);
  console.log(`  📊 Total:    ${results.length}\n`);

  if (errors.length > 0) {
    console.log('  Errores:\n');
    for (const err of errors) {
      console.log(`    - [${err.permission}] ${err.endpoint}`);
      console.log(`      ${err.error}\n`);
    }
  }

  // Permisos testeados
  const permissionsTested = [...new Set(ok.map(r => r.permission))];
  console.log(`  Permisos con al menos 1 llamada exitosa:`);
  for (const p of permissionsTested) {
    const count = ok.filter(r => r.permission === p).length;
    console.log(`    ✅ ${p} (${count} llamadas)`);
  }
  console.log('');
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

main().catch(console.error);

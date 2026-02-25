// GET/POST /api/clips — Generar y recuperar clips trending de 5 min

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateClip } from "@/lib/generate-clip";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

export const maxDuration = 300; // 5 min — Claude puede tardar en generar

const STALE_MS = 5 * 60 * 1000; // 5 min — si lleva más, considerar stale
const MAX_TOPIC_LENGTH = 200;

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config missing");
  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/clips?topic=X — Consultar estado del clip
export async function GET(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("topic")?.trim();
  if (!topic || topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Missing or invalid topic param" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("trending_clips")
    .select("status, script, articles, error_message, updated_at")
    .eq("topic", topic)
    .eq("date", today())
    .single();

  if (error || !data) {
    return NextResponse.json({ status: "not_found" });
  }

  // Si lleva más de 5 min generándose, considerar stale
  if (data.status === "generating") {
    const updatedAt = new Date(data.updated_at).getTime();
    if (Date.now() - updatedAt > STALE_MS) {
      return NextResponse.json({ status: "not_found" });
    }
    return NextResponse.json({ status: "generating" });
  }

  if (data.status === "error") {
    return NextResponse.json({ status: "error", error_message: data.error_message });
  }

  return NextResponse.json(
    { status: "ready", clip: { script: data.script, articles: data.articles } },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}

// POST /api/clips — Generar o recuperar clip
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Missing or invalid topic" }, { status: 400 });
  }

  // Rate limit: 5 req/min por IP
  const ip = getClientIP(request);
  const rl = await checkRateLimit(`clips:${ip}`, { maxRequests: 5, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = getSupabase();
  const dateToday = today();

  // Comprobar si ya existe
  const { data: existing } = await supabase
    .from("trending_clips")
    .select("status, script, articles, updated_at")
    .eq("topic", topic)
    .eq("date", dateToday)
    .single();

  if (existing) {
    if (existing.status === "ready") {
      return NextResponse.json({
        status: "ready",
        clip: { script: existing.script, articles: existing.articles },
      });
    }

    if (existing.status === "generating") {
      const updatedAt = new Date(existing.updated_at).getTime();
      if (Date.now() - updatedAt <= STALE_MS) {
        // Todavía se está generando — cliente debe hacer polling
        return NextResponse.json({ status: "generating" }, { status: 202 });
      }
      // Stale — reclamar slot
    }
  }

  // Upsert con status='generating' para reclamar slot (thundering herd)
  const { error: upsertError } = await supabase
    .from("trending_clips")
    .upsert(
      { topic, date: dateToday, status: "generating", script: "", articles: [], updated_at: new Date().toISOString() },
      { onConflict: "topic,date" }
    );

  if (upsertError) {
    return NextResponse.json({ error: "Error reservando clip" }, { status: 500 });
  }

  // Generar el clip
  try {
    const result = await generateClip(topic);

    await supabase
      .from("trending_clips")
      .update({
        status: "ready",
        script: result.script,
        articles: result.articles,
        updated_at: new Date().toISOString(),
      })
      .eq("topic", topic)
      .eq("date", dateToday);

    return NextResponse.json({
      status: "ready",
      clip: { script: result.script, articles: result.articles },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    await supabase
      .from("trending_clips")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("topic", topic)
      .eq("date", dateToday);

    return NextResponse.json({ status: "error", error_message: message }, { status: 500 });
  }
}

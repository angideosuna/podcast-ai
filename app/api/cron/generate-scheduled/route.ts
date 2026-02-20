// Cron Job: Genera podcasts automáticamente según los horarios configurados
// Se ejecuta cada hora en punto

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePodcast } from "@/lib/generate-podcast";
import { createLogger } from "@/lib/logger";

export const maxDuration = 60;

const log = createLogger("cron/generate-scheduled");

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Checks if today matches the schedule's frequency and custom_days.
 * day: 0=Sunday, 1=Monday, ..., 6=Saturday
 */
function isDayValid(frequency: string, customDays: number[], dayOfWeek: number): boolean {
  switch (frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case "custom":
      return customDays.includes(dayOfWeek);
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sunday

    // Build time window: current hour ± 15 minutes
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const windowStart = currentMinutes - 15;
    const windowEnd = currentMinutes + 15;

    const formatTime = (totalMins: number) => {
      const m = ((totalMins % 1440) + 1440) % 1440; // wrap around midnight
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    };

    const timeStart = formatTime(windowStart);
    const timeEnd = formatTime(windowEnd);

    // Query active schedules within the time window, joined with preferences
    let query = supabase
      .from("schedules")
      .select("*, preferences!inner(topics, duration, tone, voice)")
      .eq("is_active", true);

    // Handle midnight wraparound
    if (windowStart < 0) {
      // e.g., 23:50 - 00:10 → two ranges
      query = query.or(`time.gte.${formatTime(windowStart)},time.lte.${timeEnd}`);
    } else if (windowEnd >= 1440) {
      query = query.or(`time.gte.${timeStart},time.lte.${formatTime(windowEnd)}`);
    } else {
      query = query.gte("time", timeStart).lte("time", timeEnd);
    }

    const { data: schedules, error } = await query;

    if (error) {
      log.error("Error querying schedules", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const schedule of schedules || []) {
      // Check if today is a valid day for this schedule
      if (!isDayValid(schedule.frequency, schedule.custom_days || [], dayOfWeek)) {
        skipped++;
        continue;
      }

      // Skip if already generated today
      if (schedule.last_generated_at) {
        const lastGen = new Date(schedule.last_generated_at);
        if (lastGen.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
          skipped++;
          continue;
        }
      }

      // Get preferences (joined)
      const prefs = (schedule as Record<string, unknown>).preferences as {
        topics: string[];
        duration: number;
        tone: string;
        voice: string;
      } | null;

      if (!prefs || !prefs.topics?.length) {
        skipped++;
        continue;
      }

      try {
        log.info(`Generating scheduled podcast for user ${schedule.user_id}`);

        await generatePodcast({
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          userId: schedule.user_id,
          supabase,
        });

        // Update last_generated_at
        await supabase
          .from("schedules")
          .update({ last_generated_at: now.toISOString() })
          .eq("id", schedule.id);

        generated++;
      } catch (err) {
        log.error(`Error generating for user ${schedule.user_id}`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("[cron/generate-scheduled] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

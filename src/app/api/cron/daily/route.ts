// GET /api/cron/daily → DailyCheckReport. Appelée une fois par jour par le cron Vercel
// (voir vercel.json), avec « Authorization: Bearer CRON_SECRET » vérifié par le middleware.

import { NextResponse } from "next/server";
import { dailyCheck } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const report = await dailyCheck.execute();
    console.log("Vérification quotidienne", report);
    return NextResponse.json(report);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

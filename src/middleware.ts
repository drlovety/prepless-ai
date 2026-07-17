import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/settings",
    "/api/my-lessons",
    "/api/generate-lesson",
    "/api/redeem-code",
    "/api/export-pptx",
    "/api/notifications",
  ],
};

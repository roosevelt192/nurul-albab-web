import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default async function Icon() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("pengaturan_pesantren")
    .select("logo_url")
    .limit(1)
    .maybeSingle();

  // Jika logo sudah diunggah oleh admin
  if (data?.logo_url) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.logo_url}
            alt="Favicon"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // Fallback default jika logo belum diunggah (gradien NAIS)
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4457ff 0%, #7583fd 100%)",
          borderRadius: "8px",
          color: "white",
          fontSize: "18px",
          fontWeight: "bold",
        }}
      >
        ✦
      </div>
    ),
    { ...size }
  );
}
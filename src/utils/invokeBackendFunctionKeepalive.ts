import { supabase } from "@/integrations/supabase/client";

type FunctionResponse<T> = T;

export async function invokeBackendFunctionKeepalive<T = unknown>(
  functionName: string,
  body: unknown,
): Promise<FunctionResponse<T>> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token || anonKey;

  const res = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    keepalive: true,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Function ${functionName} failed: ${res.status} ${text || ""}`.trim());
  }

  return (text ? JSON.parse(text) : null) as T;
}

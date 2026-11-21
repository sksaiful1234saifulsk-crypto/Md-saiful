import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedAdminClient;
}

export async function createSupabaseSignedUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 120
): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

export async function verifyTelegramBotMembership(params: {
  chatId: string;
  telegramUserId: string;
}): Promise<{ supported: boolean; isMember: boolean; statusText: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken || !params.chatId || !params.telegramUserId) {
    return {
      supported: false,
      isMember: false,
      statusText: 'Manual admin verification required',
    };
  }

  // Telegram user IDs must be numeric
  if (!/^-?\d+$/.test(params.telegramUserId.trim())) {
    return {
      supported: true,
      isMember: false,
      statusText: 'Numeric Telegram User ID required for automated Bot API verification',
    };
  }

  try {
    const apiUrl = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getChatMember`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId.trim(),
        user_id: Number(params.telegramUserId.trim()),
      }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      result?: { status?: string };
      description?: string;
    };

    if (!json.ok || !json.result?.status) {
      return {
        supported: true,
        isMember: false,
        statusText: json.description || 'Membership not verified via Telegram Bot API',
      };
    }

    const memberStatus = json.result.status;
    const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(memberStatus);
    return {
      supported: true,
      isMember,
      statusText: isMember
        ? `Verified via Telegram Bot API (${memberStatus})`
        : `User status in channel: ${memberStatus}`,
    };
  } catch {
    return {
      supported: false,
      isMember: false,
      statusText: 'Telegram API unreachable; queued for manual verification',
    };
  }
}

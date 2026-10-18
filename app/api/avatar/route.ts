import { apiAccount, apiError } from '@/lib/api';
import { downloadAvatar } from '@/lib/avatar';
export async function GET(request: Request) {
  try {
    const account = await apiAccount(request);
    const blob = await downloadAvatar(account.memberId);
    return blob
      ? new Response(blob, {
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      : new Response(null, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

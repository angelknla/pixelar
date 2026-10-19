import { apiAccount, apiError } from '@/lib/api';
import { downloadCover, uploadCover } from '@/lib/cover';
import { uuid } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const account = await apiAccount(request, true);
    const { id } = await context.params;
    // Reject oversized requests before parsing multipart data; bytes are checked again by Sharp.
    const size = Number(request.headers.get('content-length'));
    if (size > 6 * 1024 * 1024) throw new Error('Choose an image under 5 MB.');
    const form = await request.formData();
    const file = form.get('cover');
    if (!(file instanceof File) || !file.size) throw new Error('Choose a cover image.');
    const url = await uploadCover(account.memberId, uuid(id), file);
    return Response.json({ url });
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: Request, context: Context) {
  try {
    const account = await apiAccount(request);
    const { id } = await context.params;
    const version = uuid(new URL(request.url).searchParams.get('v'));
    const image = await downloadCover(account.memberId, uuid(id), version);
    return new Response(image, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

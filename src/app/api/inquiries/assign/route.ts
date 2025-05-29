import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const supabase = await createClient();
interface PostRequestBody {
    inquiryId: string;
    userId: string;
}

interface PostResponse {
    success?: boolean;
    error?: string;
}

export async function POST(request: Request): Promise<Response> {
    const { inquiryId, userId }: PostRequestBody = await request.json();

    const { error } = await supabase
        .from('inquiries')
        .update({ assigned_to: userId })
        .eq('id', inquiryId);

    if (error) {
        return NextResponse.json<PostResponse>({ error: 'Failed to assign inquiry' }, { status: 500 });
    }

    return NextResponse.json<PostResponse>({ success: true });
}
import { NextResponse } from 'next/server';
import { supabase } from '../../../layout';

interface PostRequestBody {
    inquiryId: string;
    status: string;
}

interface PostResponseSuccess {
    success: boolean;
}

interface PostResponseError {
    error: string;
}

export async function POST(request: Request): Promise<Response> {
    const { inquiryId, status }: PostRequestBody = await request.json();

    const { error } = await supabase
        .from('inquiries')
        .update({ status })
        .eq('id', inquiryId);

    if (error) {
        return NextResponse.json<PostResponseError>({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json<PostResponseSuccess>({ success: true });
}
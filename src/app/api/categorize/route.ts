import { NextResponse } from 'next/server';
import { supabase } from '../../layout';

const keywordCategories = {
  sales: ['sale', 'discount', 'offer'],
  marketing: ['campaign', 'ad', 'promotion'],
  accounting: ['invoice', 'payment', 'receipt'],
  partnership: ['partner', 'collaboration', 'affiliate'],
  investment: ['invest', 'funding', 'capital'],
  events: ['event', 'webinar', 'conference'],
};

// Removed unused Inquiry interface

type KeywordCategories = Record<string, string[]>;

function categorizeInquiry(subject: string, body: string): string {
    for (const [category, keywords] of Object.entries(keywordCategories as KeywordCategories)) {
        for (const keyword of keywords) {
            if (
                subject.toLowerCase().includes(keyword) ||
                body.toLowerCase().includes(keyword)
            ) {
                return category;
            }
        }
    }
    return 'uncategorized';
}

interface PostRequestBody {
    inquiryId: string;
}

interface InquiryData {
    id: string;
    subject: string;
    body: string;
}

interface SupabaseResponse<T> {
    data: T | null;
    error: Error | null;
}

export async function POST(request: Request): Promise<Response> {
    const { inquiryId }: PostRequestBody = await request.json();

    const { data: inquiry, error }: SupabaseResponse<InquiryData> = await supabase
        .from('inquiries')
        .select('id, subject, body')
        .eq('id', inquiryId)
        .single();

    if (error || !inquiry) {
        return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const category: string = categorizeInquiry(inquiry.subject, inquiry.body);

    const { error: updateError }: SupabaseResponse<null> = await supabase
        .from('inquiries')
        .update({ category })
        .eq('id', inquiryId);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, category });
}
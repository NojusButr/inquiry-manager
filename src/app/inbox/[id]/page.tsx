'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../layout';

export default function InquiryDetails() {
  const { id } = useParams();
  interface Inquiry {
    id: string;
    subject: string;
    from_email: string;
    received_at: string;
    status: string;
    category: string;
    thread_id: string;
    original_id: string;
    body: string;
    assigned_to: string;
  }

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  interface Comment {
    message: string;
    created_at: string;
    user_id: string;
  }

  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchInquiryDetails = async () => {
      const { data: inquiryData, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('id', id)
        .single();

      if (!error) setInquiry(inquiryData);

      const { data: commentsData } = await supabase
        .from('internal_comments')
        .select('message, created_at, user_id')
        .eq('inquiry_id', id)
        .order('created_at', { ascending: true });

      setComments(commentsData || []);
    };

    fetchInquiryDetails();
  }, [id]);

  const handleReply = async () => {
    const message = prompt('Enter your reply:');
    if (message && inquiry) {
      const { error } = await supabase.from('internal_comments').insert({
        inquiry_id: inquiry.id,
        user_id: inquiry.assigned_to, // Or the logged-in user ID
        message,
      });

      if (!error) {
        alert('Reply added');
        location.reload();
      }
    }
  };

  if (!inquiry) return <p>Loading...</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Inquiry Details</h1>
      <div className="space-y-1 text-sm">
        <p><strong>Subject:</strong> {inquiry.subject}</p>
        <p><strong>From:</strong> {inquiry.from_email}</p>
        <p><strong>Received At:</strong> {new Date(inquiry.received_at).toLocaleString()}</p>
        <p><strong>Status:</strong> {inquiry.status}</p>
        <p><strong>Category:</strong> {inquiry.category}</p>
        <p><strong>Thread ID:</strong> {inquiry.thread_id}</p>
        <p><strong>Original ID:</strong> {inquiry.original_id}</p>
        <p className="mt-4"><strong>Body:</strong></p>
        <pre className="bg-gray-100 p-4 rounded">{inquiry.body}</pre>
      </div>

      <div className="space-y-2 mt-6">
        <h2 className="text-xl font-medium">Threaded Comments</h2>
        {comments.length === 0 ? (
          <p className="text-gray-500">No comments yet.</p>
        ) : (
          comments.map((comment, idx) => (
            <div key={idx} className="p-3 bg-gray-50 border rounded">
              <p className="text-sm">{comment.message}</p>
              <p className="text-xs text-gray-400">
                By {comment.user_id} on {new Date(comment.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleReply}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add Comment
      </button>
    </div>
  );
}

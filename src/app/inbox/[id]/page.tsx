import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../layout';

// Removed unused TiptapEditor import

export default function InquiryDetails() {
  const router = useRouter();
  const { id } = router.query;
  interface Inquiry {
    id: string;
    subject: string;
    from_email: string;
    received_at: string;
    status: string;
    category: string;
    body: string;
  }

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  // Removed unused error state

  useEffect(() => {
    if (!id) return;

    const fetchInquiry = async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) console.error(error.message);
      else setInquiry(data);
    };

    fetchInquiry();
  }, [id]);

interface AssignRequest {
    inquiryId: string;
    userId: string;
}

const handleAssign = async (userId: string): Promise<void> => {
    if (!inquiry) {
        alert('Inquiry data is not available.');
        return;
    }
    const requestBody: AssignRequest = { inquiryId: inquiry.id, userId };
    const response = await fetch('/api/inquiries/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (response.ok) {
        alert('Inquiry assigned successfully!');
    } else {
        alert('Failed to assign inquiry.');
    }
};

  // Example usage of handleAssign
  const assignToUser = () => {
    const userId = prompt('Enter user ID to assign:');
    if (userId) handleAssign(userId);
  };

  // Adding a button to use assignToUser
  <button onClick={assignToUser}>Assign Inquiry</button>

interface StatusChangeRequest {
    inquiryId: string;
    status: string;
}

const handleStatusChange = async (status: string): Promise<void> => {
    if (!inquiry) {
        alert('Inquiry data is not available.');
        return;
    }
    const requestBody: StatusChangeRequest = { inquiryId: inquiry.id, status };
    const response = await fetch('/api/inquiries/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (response.ok) {
        alert('Status updated successfully!');
    } else {
        alert('Failed to update status.');
    }
};

  // Adding a button to use handleStatusChange
  const changeStatus = () => {
    const newStatus = prompt('Enter new status:');
    if (newStatus) handleStatusChange(newStatus);
  };

  if (!inquiry) return <p>Loading...</p>;

interface ReplyRequest {
    inquiryId: string;
    message: string;
}

const handleReply = async (message: string): Promise<void> => {
    if (!inquiry) {
        alert('Inquiry data is not available.');
        return;
    }
    const requestBody: ReplyRequest = { inquiryId: inquiry.id, message };
    const response = await fetch('/api/inquiries/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (response.ok) {
        alert('Reply sent successfully!');
    } else {
        alert('Failed to send reply.');
    }
};

return (
    <div>
        <h1>Inquiry Details</h1>
        {inquiry ? (
            <div>
                <p>Subject: {inquiry.subject}</p>
                <p>From: {inquiry.from_email}</p>
                <p>Received At: {inquiry.received_at}</p>
                <p>Status: {inquiry.status}</p>
                <p>Category: {inquiry.category}</p>
                <p>Body: {inquiry.body}</p>
                <button onClick={assignToUser}>Assign Inquiry</button>
                <button onClick={changeStatus}>Change Status</button>
                <button onClick={() => {
                    const message = prompt('Enter your reply:');
                    if (message) handleReply(message);
                }}>Reply</button>
            </div>
        ) : (
            <p>Loading...</p>
        )}
    </div>
);
}
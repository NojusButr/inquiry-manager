"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../layout";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

interface Inquiry {
  id: string;
  subject: string;
  from_email: string;
  received_at: string;
  is_read?: boolean;
  shipment_id?: string | null;
  thread_id: string;
  status?: string;
  body?: string;
  assigned_to?: string;
  email_account_id?: string; // add for sending
  original_id?: string; // add for inReplyTo/references
}

interface Shipment {
  id: string;
  shipment_number: string;
  status?: string;
  eta?: string;
}

interface ThreadMessage {
  id: string;
  from_email: string;
  body: string;
  received_at?: string;
  sent_at?: string;
  original_id?: string;
  sent_by_name?: string;
  sent_by_email?: string;
}


interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export default function ShipmentInquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("id");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [sentThreadMessages, setSentThreadMessages] = useState<ThreadMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardMessage, setForwardMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<SupabaseUser[]>([]);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    if (!shipmentId) return;
    supabase.from("shipments").select("*").eq("id", shipmentId).single().then(({ data }) => setShipment(data as Shipment));
    supabase.from("inquiries").select("*").eq("shipment_id", shipmentId).then(({ data }) => setInquiries((data || []) as Inquiry[]));
  }, [shipmentId]);

  useEffect(() => {
    if (!selectedInquiry) return;
    supabase.from("inquiries").select("*").eq("thread_id", selectedInquiry.thread_id).order("received_at", { ascending: true }).then(({ data }) => setThreadMessages((data || []) as ThreadMessage[]));
    supabase
  .from("sent_emails")
  .select("*, users:sent_by(name, email)")
  .eq("thread_id", selectedInquiry.thread_id)
  .order("sent_at", { ascending: true })
  .then(({ data }) => {
    const enriched = (data || []).map((msg) => ({
      ...msg,
      from_email: msg.users?.email || "unknown",
      sent_by_name: msg.users?.name || "",
      sent_by_email: msg.users?.email || "",
    }));
    setSentThreadMessages(enriched as ThreadMessage[]);
  });

  }, [selectedInquiry]);

  // Add: fetch all company users for assignment dropdown, regardless of assigned_to
  useEffect(() => {
    const fetchCompanyUsers = async () => {
      if (!shipmentId) return;
      // Try to get company_id from the shipment
      const { data: shipmentRow } = await supabase.from("shipments").select("id").eq("id", shipmentId).single();
      if (!shipmentRow) return;
      // Try to get company_id from any inquiry in this shipment
      const { data: inq } = await supabase.from("inquiries").select("assigned_to").eq("shipment_id", shipmentId).limit(1).single();
      let companyId = null;
      if (inq?.assigned_to) {
        const { data: userRow } = await supabase.from("users").select("company_id").eq("id", inq.assigned_to).single();
        companyId = userRow?.company_id;
      }
      // Fallback: try to get company_id from the shipment creator (if you store it)
      if (!companyId) {
        // You may need to adjust this if you store company_id elsewhere
        return;
      }
      const { data: usersData } = await supabase.from("users").select("id, name, email, role").eq("company_id", companyId);
      setCompanyUsers(usersData || []);
    };
    fetchCompanyUsers();
  }, [shipmentId]);

  // Fetch current user for sentBy
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: customUser } = await supabase
        .from("users")
        .select("id, email, name, role")
        .eq("auth_id", authUser.id)
        .single();
      setUser(customUser || null);
    };
    fetchUser();
  }, []);

  // Mark inquiry as read when selected
  const handleSelectInquiry = async (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    if (!inquiry.is_read) {
      setInquiries((prev) => prev.map((i) => i.id === inquiry.id ? { ...i, is_read: true } : i));
      await supabase.from("inquiries").update({ is_read: true }).eq("id", inquiry.id);
    }
  };

  // Helper: get emailAccountId, inReplyTo, references from selectedInquiry
  const getEmailAccountId = () => selectedInquiry?.email_account_id;
  const getInReplyTo = () => selectedInquiry?.original_id || selectedInquiry?.id;
  const getReferences = () => selectedInquiry?.original_id || selectedInquiry?.id;

  return (
    <div className="space-y-8 px-4 md:px-8 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="secondary" onClick={() => router.back()}>Back</Button>
        <h1 className="text-2xl font-bold">Shipment: <span className="text-blue-700 font-mono">{shipment?.shipment_number}</span></h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Inquiry list */}
        <div className="border-accent">
          <div className="h-[600px] w-full pr-2 custom-scrollbar overflow-y-auto">
            <ul className="divide-y">
              {inquiries.map((inquiry) => (
                <li
                  key={inquiry.id}
                  className={`p-4 border rounded-md cursor-pointer shadow-md hover:bg-gray-200 transition-colors duration-100 flex items-center gap-2 ${selectedInquiry?.id === inquiry.id ? "bg-blue-100" : inquiry.is_read ? "bg-white opacity-70" : "bg-blue-50 border-blue-400"}`}
                  onClick={() => handleSelectInquiry(inquiry)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className={`text-base line-clamp-1 ${!inquiry.is_read ? 'font-extrabold text-gray-900' : 'font-normal text-gray-500'}`}>{inquiry.subject}</h2>
                      {inquiry.status && (
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          inquiry.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                          inquiry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                          inquiry.status === 'resolved' ? 'bg-green-100 text-green-700 border-green-300' :
                          'bg-gray-100 text-gray-700 border-gray-300'
                        }`}>
                          {inquiry.status === 'new' ? 'New' : inquiry.status === 'in_progress' ? 'In Progress' : inquiry.status === 'resolved' ? 'Resolved' : inquiry.status}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${inquiry.is_read ? 'text-gray-400' : 'text-muted-foreground'}`}>From: {inquiry.from_email}</p>
                    <p className="text-xs text-gray-400">Received: {new Date(inquiry.received_at).toLocaleString()}</p>
                    {inquiry.body && <p className="text-xs text-gray-500 line-clamp-2">{inquiry.body.slice(0, 120)}{inquiry.body.length > 120 ? '...' : ''}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-semibold text-xs">Assigned to:</span>
                      <span className="text-xs text-gray-700">{companyUsers.find(u => u.id === inquiry.assigned_to)?.name || companyUsers.find(u => u.id === inquiry.assigned_to)?.email || 'Unassigned'}</span>
                    </div>
                  </div>
                  {!inquiry.is_read && (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" title="Unread" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Right: Inquiry details */}
        <div className="border rounded-xl bg-white min-h-[200px]">
          {selectedInquiry ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-semibold text-lg">{selectedInquiry.subject}</h2>
                {/* Status dropdown */}
                <select
                  value={selectedInquiry.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    await supabase
                      .from("inquiries")
                      .update({ status: newStatus })
                      .eq("id", selectedInquiry.id);
                    setSelectedInquiry((prev) => prev && { ...prev, status: newStatus });
                    setInquiries((prev) => prev.map(i => i.id === selectedInquiry.id ? { ...i, status: newStatus } : i));
                  }}
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    selectedInquiry.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                    selectedInquiry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    selectedInquiry.status === 'resolved' ? 'bg-green-100 text-green-700 border-green-300' :
                    'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                  style={{ minWidth: 120 }}
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">Shipment:</span>
                <span className="text-blue-700 font-mono">{shipment?.shipment_number || 'Unknown'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Assigned to: </span>
                <select
                  value={selectedInquiry.assigned_to || ""}
                  onChange={async (e) => {
                    const newUserId = e.target.value;
                    await supabase
                      .from("inquiries")
                      .update({ assigned_to: newUserId })
                      .eq("id", selectedInquiry.id);
                    setSelectedInquiry((prev) => prev && { ...prev, assigned_to: newUserId });
                  }}
                  className="ml-2 border rounded px-2 py-1"
                >
                  <option value="">Unassigned</option>
                  {companyUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {[...threadMessages, ...sentThreadMessages]
                  .sort((a, b) => {
                    const aDate = a.received_at ?? a.sent_at ?? '';
                    const bDate = b.received_at ?? b.sent_at ?? '';
                    return new Date(aDate).getTime() - new Date(bDate).getTime();
                  })
                  .map((msg, idx) => (
                    <div key={msg.id || msg.original_id || idx} className="border rounded p-2 bg-gray-100">
                     <p className="text-sm text-muted-foreground">
                        From: {msg.from_email || msg.sent_by_email || "Unknown sender"}
                        {msg.sent_by_name && msg.sent_by_email && (
                            <> (sent by {msg.sent_by_name})</>
                        )}
                        </p>
                      <p className="text-xs text-gray-400">Received: {msg.received_at ? new Date(msg.received_at).toLocaleString() : msg.sent_at ? new Date(msg.sent_at).toLocaleString() : ""}</p>
                      <p className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body) }} />
                    </div>
                  ))}
              </div>
              <div className="mt-4 flex gap-2">
                <textarea
                  className="w-full border rounded p-2"
                  rows={4}
                  placeholder="Type your reply..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  disabled={sending}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    className="px-4 py-2 border-2 border-blue-600 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    variant="default"
                    disabled={sending}
                    onClick={async () => {
                      if (!replyBody.trim() || !selectedInquiry) return;
                      setSending(true);
                      try {
                        const res = await fetch("/api/gmail/send", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            emailAccountId: getEmailAccountId(),
                            to: selectedInquiry.from_email,
                            subject: `Re: ${selectedInquiry.subject}`,
                            message: replyBody.trim(),
                            threadId: selectedInquiry.thread_id,
                            inReplyTo: getInReplyTo(),
                            references: getReferences(),
                            sentBy: user?.id,
                          }),
                        });
                        if (!res.ok) throw new Error("Failed to send email");
                        setReplyBody("");
                        setSentThreadMessages((prev) => [
                          ...prev,
                          {
                            id: `local-${Date.now()}`,
                            from_email: selectedInquiry.from_email,
                            body: replyBody.trim(),
                            sent_at: new Date().toISOString(),
                            original_id: getInReplyTo(),
                          },
                        ]);
                      } finally {
                        setSending(false);
                      }
                    }}
                    aria-label="Send Reply"
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </Button>
                  <Button
                    className="px-4 py-2 border-2 border-gray-400 shadow transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
                    variant="secondary"
                    onClick={() => setShowForward(true)}
                    aria-label="Forward"
                    disabled={sending}
                  >
                    Forward
                  </Button>
                </div>
              </div>
              {/* Forward modal UI */}
              {showForward && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="bg-white rounded shadow-2xl border border-gray-200 p-6 w-full max-w-md">
                    <h2 className="text-lg font-bold mb-2">Forward Inquiry</h2>
                    <div className="mb-2">
                      <label className="block text-sm font-medium">Forward to (email address)</label>
                      <input
                        className="w-full border rounded p-2"
                        type="email"
                        value={forwardTo}
                        onChange={e => setForwardTo(e.target.value)}
                        placeholder="recipient@example.com"
                        disabled={sending}
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium">Message (optional)</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        value={forwardMessage}
                        onChange={e => setForwardMessage(e.target.value)}
                        disabled={sending}
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        className="px-4 py-2 border-2 border-blue-600 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        variant="default"
                        disabled={sending}
                        onClick={async () => {
                          if (!selectedInquiry || !forwardTo) return;
                          setSending(true);
                          try {
                            const res = await fetch("/api/gmail/send", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                emailAccountId: getEmailAccountId(),
                                to: forwardTo,
                                subject: `Fwd: ${selectedInquiry.subject}`,
                                message: `${forwardMessage ? forwardMessage + '\n\n' : ''}---------- Forwarded message ----------\nFrom: ${selectedInquiry.from_email}\nDate: ${selectedInquiry.received_at}\nSubject: ${selectedInquiry.subject}\n\n${selectedInquiry.body}`,
                                threadId: null,
                                sentBy: user?.id,
                              }),
                            });
                            if (!res.ok) throw new Error("Failed to forward email");
                            setShowForward(false);
                            setForwardMessage("");
                            setForwardTo("");
                          } finally {
                            setSending(false);
                          }
                        }}
                      >
                        {sending ? "Forwarding..." : "Forward"}
                      </Button>
                      <Button
                        className="px-4 py-2 border-2 border-gray-400 shadow transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
                        variant="secondary"
                        onClick={() => setShowForward(false)}
                        disabled={sending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">Select a message to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../layout";
import "../globals.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DOMPurify from "dompurify"; // Import DOMPurify for HTML sanitization
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react"
import ShipmentsManager from "./ShipmentsManager";
import { SupabaseClient } from "@supabase/supabase-js";

interface Inquiry {
  id: string;
  subject: string;
  from_email: string;
  received_at: string;
  status: "new" | "in_progress" | "resolved";
  thread_id: string;
  original_id: string;
  body: string;
  assigned_to: string;
  is_read?: boolean; // Add is_read field
  email_account_id?: string; // Add email_account_id for deletion logic
  shipment_id?: string | null; // Add shipment_id for shipment linking
}

interface InquiryCategory {
  inquiry_id: string;
  category: string;
}

interface InquiryCountry {
  inquiry_id: string;
  country: string;
}

interface SupabaseUser {
  id: string;
  email: string;
  company_id?: string; // Add company_id to type
  [key: string]: string | number | boolean | null | undefined;
}

interface ThreadMessage {
  id: string;
  from_email: string;
  body: string;
  received_at: string;
  sent_at?: string; // For sent_emails
  original_id?: string; // For sent_emails or inquiries
  sent_by?: string; // For sent_emails: user id of sender
}

// Add shipment type
interface Shipment {
  id: string;
  shipment_number: string;
  status?: string;
  eta?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  marketing: "Marketing",
  accounting: "Accounting",
  partnership: "Partnership",
  investment: "Investment",
  events: "Events",
};

// Helper for status badge
const STATUS_LABELS: Record<Inquiry["status"], string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const STATUS_COLORS: Record<Inquiry["status"], string> = {
  new: "bg-blue-100 text-blue-700 border-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-300",
  resolved: "bg-green-100 text-green-700 border-green-300",
};

export default function Inbox() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [inquiryCategories, setInquiryCategories] = useState<InquiryCategory[]>([]);
  const [inquiryCountries, setInquiryCountries] = useState<InquiryCountry[]>([]);

  const [channels, setChannels] = useState<{ name: string; label: string; count: number; accounts: { id: string; label: string }[] }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Add a sync state
  const [syncing, setSyncing] = useState(false);

  // Expose fetchUserAndInbox for manual reload after sync
  const fetchUserAndInboxRef = useRef<null | (() => Promise<void>)>(null);

  // State to track if the channel was manually selected
  const [manuallySelectedChannel, setManuallySelectedChannel] = useState(false);

  // Compose email states
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | null>(null);
  const [composeReferences, setComposeReferences] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Forward modal state
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardMessage, setForwardMessage] = useState("");

  // Fetch sent emails for the current thread
  const [sentThreadMessages, setSentThreadMessages] = useState<ThreadMessage[]>([]);
  useEffect(() => {
    const fetchSentThreadMessages = async () => {
      if (selectedInquiry && selectedInquiry.thread_id) {
        const { data, error } = await supabase
          .from("sent_emails")
          .select("*")
          .eq("thread_id", selectedInquiry.thread_id)
          .order("sent_at", { ascending: true });
        if (!error) setSentThreadMessages(data || []);
      } else {
        setSentThreadMessages([]);
      }
    };
    fetchSentThreadMessages();
  }, [selectedInquiry]);

  // Function to trigger Gmail fetch and reload inbox
  const handleSyncGmail = async () => {
    setSyncing(true);
    try {
      // Read fetch limit from localStorage
      const fetchLimit = localStorage.getItem('gmailFetchLimit') || '5';
      // Send as custom header
      const res = await fetch('/api/gmail/fetch', {
        headers:
         {
          'X-Gmail-Fetch-Limit': fetchLimit,
         },
      });
      if (!res.ok) throw new Error('Failed to sync Gmail');
      // After sync, reload inbox data
      if (fetchUserAndInboxRef.current) await fetchUserAndInboxRef.current();
    } catch (err) {
      console.error('Gmail sync failed:', err);
      alert('Failed to sync Gmail. See console for details.');
    } finally {
      setSyncing(false);
    }
  };

  // Move fetchUserAndInbox outside of useEffect so it can be called manually
  async function fetchUserAndInbox() {
    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !authUser) {
        console.error("Error fetching auth user:", userError);
        return;
      }
      console.log("authUser for custom user lookup:", authUser);

      const { data: customUser, error: customUserError } = await supabase
        .from("users")
        .select("id, email, company_id")
        .eq("auth_id", authUser.id)
        .single();

      if (customUserError || !customUser) {
        console.error("Error fetching custom user:", customUserError, customUser);
        return;
      }

      setUser(customUser);

      // Use company_id from customUser directly
      const companyId = customUser.company_id;
      if (!companyId) {
        console.error("User has no company_id", customUser);
        setInquiries([]);
        setChannels([]);
        return;
      }

      // Fetch all email accounts for the company
      const { data: emailAccounts, error: emailAccountsError } = await supabase
        .from("email_accounts")
        .select("id, email_address")
        .eq("company_id", companyId);
      if (emailAccountsError) {
        console.error("Error fetching email accounts:", emailAccountsError);
        setInquiries([]);
        setChannels([]);
        return;
      }
      // Build channels array (future-proof for more channels)
      const channelList = [];
      if (emailAccounts && emailAccounts.length > 0) {
        channelList.push({
          name: "email",
          label: "Email",
          count: emailAccounts.length,
          accounts: emailAccounts.map((ea: { id: string; email_address: string }) => ({ id: ea.id, label: ea.email_address })),
        });
      }
      // TODO: Add WhatsApp or other channels here if/when integrated
      setChannels(channelList);
      // Default: select first channel if none selected
      if (!selectedChannel && channelList.length > 0 && !manuallySelectedChannel) {
        setSelectedChannel(channelList[0].name);
        setSelectedAccounts(channelList[0].accounts.map((a) => a.id));
      }

      // Fetch inquiries for these email accounts only
      const emailAccountIds = (emailAccounts || []).map((ea) => ea.id);
      if (emailAccountIds.length === 0) {
        setInquiries([]);
        return;
      }

      // Fetch inquiries for these email accounts only
      const { data: inquiriesData, error: inquiriesError } = await supabase
        .from("inquiries")
        .select("*")
        .in("email_account_id", emailAccountIds);
      if (inquiriesError) {
        console.error(inquiriesError.message);
        setInquiries([]);
      } else {
        setInquiries(inquiriesData || []);
      }
    } catch (error) {
      console.error("Failed to fetch user or inbox:", error);
    }
  }

  useEffect(() => {
    fetchUserAndInboxRef.current = fetchUserAndInbox;
    fetchUserAndInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchThreadMessages = async () => {
      if (selectedInquiry) {
        const { data, error } = await supabase
          .from("inquiries")
          .select("*")
          .eq("thread_id", selectedInquiry.thread_id)
          .order("received_at", { ascending: true });

        if (error) {
          console.error("Error fetching thread messages:", error);
        } else {
          setThreadMessages(data || []);
        }
      }
    };

    fetchThreadMessages();
  }, [selectedInquiry]);

  // Fetch filter options and mapping
  useEffect(() => {
    const fetchFilters = async () => {
      if (!user || inquiries.length === 0) {
        setCategories([]);
        setCountries([]);
        setInquiryCategories([]);
        setInquiryCountries([]);
        return;
      }
      const userInquiryIds = inquiries.map((inq) => inq.id);
      console.log("User inquiry IDs:", userInquiryIds);

      // Fetch categories for user's inquiries
      const { data: catRows } = await supabase
        .from("inquiry_categories")
        .select("inquiry_id, category")
        .in("inquiry_id", userInquiryIds)
        .neq("category", null);
      console.log("Fetched inquiry_categories:", catRows);
      setInquiryCategories(catRows || []);
      const uniqueCategories = Array.from(
        new Set(
          (catRows || [])
            .map((row: InquiryCategory) => row.category?.trim())
            .filter((cat) => cat && cat.length > 0)
        )
      );
      setCategories(uniqueCategories);

      // Fetch countries for user's inquiries
      const { data: countryRows } = await supabase
        .from("inquiry_countries")
        .select("inquiry_id, country")
        .in("inquiry_id", userInquiryIds)
        .neq("country", null);
      console.log("Fetched inquiry_countries:", countryRows);
      setInquiryCountries(countryRows || []);
      const uniqueCountries = Array.from(
        new Set(
          (countryRows || [])
            .map((row: InquiryCountry) => row.country?.trim())
            .filter((country) => country && country.length > 0)
        )
      );
      setCountries(uniqueCountries);
    };
    fetchFilters();
  }, [user, inquiries]);

  const [searchQuery, setSearchQuery] = useState("");

  // Filtered inquiries (add channel/account filter and search)
  let filteredInquiries = inquiries.filter((inquiry) => {
    // Channel/account filter
    if (selectedChannel && selectedAccounts.length > 0) {
      if (!selectedAccounts.includes(inquiry.email_account_id || "")) return false;
    }
    // Search filter (match any field)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const fields = [
        inquiry.subject,
        inquiry.body,
        inquiry.from_email,
        inquiry.status,
        inquiry.thread_id,
        inquiry.original_id,
        inquiry.assigned_to,
        inquiry.id,
      ];
      if (!fields.some(f => (f || "").toLowerCase().includes(q))) return false;
    }
    // If no filters, show all
    if (selectedCategories.length === 0 && selectedCountries.length === 0)
      return true;
    let matchesCategory = true;
    let matchesCountry = true;
    if (selectedCategories.length > 0) {
      matchesCategory = selectedCategories.some((cat) =>
        inquiryCategories.some(
          (ic) => ic.inquiry_id === inquiry.id && ic.category === cat
        )
      );
    }
    if (selectedCountries.length > 0) {
      matchesCountry = selectedCountries.some((country) =>
        inquiryCountries.some(
          (ic) => ic.inquiry_id === inquiry.id && ic.country === country
        )
      );
    }
    return matchesCategory && matchesCountry;
  });
  // Sort: unread first, then by date descending
  filteredInquiries = filteredInquiries.sort((a, b) => {
    if ((a.is_read ? 1 : 0) !== (b.is_read ? 1 : 0)) {
      return (a.is_read ? 1 : 0) - (b.is_read ? 1 : 0); // unread (is_read: false) first
    }
    return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
  });

  const handleReplySubmit = async () => {
    if (!replyBody.trim() || !selectedInquiry || !user) return;
    try {
      // 1. Send email via Gmail API
      const emailAccountId = selectedInquiry.email_account_id;
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAccountId,
          to: selectedInquiry.from_email,
          subject: `Re: ${selectedInquiry.subject}`,
          message: replyBody.trim(),
          threadId: selectedInquiry.thread_id,
          inReplyTo: selectedInquiry.original_id,
          references: selectedInquiry.original_id,
          sentBy: user.id, // Pass user id to backend
        }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      setReplyBody("");
      // Optionally refresh sentThreadMessages
      const { data } = await supabase
        .from("sent_emails")
        .select("*")
        .eq("thread_id", selectedInquiry.thread_id)
        .order("sent_at", { ascending: true });
      setSentThreadMessages(data || []);
      // --- Trigger a light Gmail sync (limit 5) ---
      const prevLimit = localStorage.getItem('gmailFetchLimit');
      localStorage.setItem('gmailFetchLimit', '5');
      await handleSyncGmail();
      if (prevLimit !== null) {
        localStorage.setItem('gmailFetchLimit', prevLimit);
      } else {
        localStorage.removeItem('gmailFetchLimit');
      }
      // --- End sync ---
    } catch (err) {
      console.error("Error sending reply:", err);
      alert("Error sending reply: " + (err instanceof Error ? err.message : JSON.stringify(err)));
    }
  };

  // Mark inquiry as read when selected
  const handleSelectInquiry = async (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    if (!inquiry.is_read) {
      // Optimistically update UI
      setInquiries((prev) => prev.map((i) => i.id === inquiry.id ? { ...i, is_read: true } : i));
      // Update in DB
      await supabase.from("inquiries").update({ is_read: true }).eq("id", inquiry.id);
    }
  };

  // Delete inquiry from database and Gmail via API routes, respecting user setting
  const handleDeleteInquiry = async (inquiry: Inquiry) => {
    if (!window.confirm("Are you sure you want to delete this inquiry? This will also delete it from Gmail if enabled in settings.")) return;
    try {
      const deleteFromGmail = typeof window !== 'undefined' && localStorage.getItem('deleteFromGmail') === 'true';
      // 1. Delete from Gmail via API route if enabled
      if (deleteFromGmail) {
        await fetch('/api/gmail/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: inquiry.id }),
        });
      }
      // 2. Delete from database via API route
      await fetch('/api/inquiries/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: inquiry.id }),
      });
      setInquiries((prev) => prev.filter((i) => i.id !== inquiry.id));
      setSelectedInquiry(null);
    } catch (err) {
      console.error("Failed to delete inquiry:", err);
      alert("Failed to delete inquiry. See console for details.");
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      // Use the first selected account for sending
      const emailAccountId = selectedAccounts[0];
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAccountId,
          to: composeTo,
          subject: composeSubject,
          message: composeBody,
          threadId: composeThreadId,
          inReplyTo: composeInReplyTo,
          references: composeReferences,
        }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      setShowCompose(false);
      setComposeBody("");
      setComposeSubject("");
      setComposeTo("");
      setComposeThreadId(null);
      setComposeInReplyTo(null);
      setComposeReferences(null);
      // Optionally refresh sentThreadMessages
      if (selectedInquiry) {
        const { data } = await supabase
          .from("sent_emails")
          .select("*")
          .eq("thread_id", selectedInquiry.thread_id)
          .order("sent_at", { ascending: true });
        setSentThreadMessages(data || []);
      }
    } catch {
      alert("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  // Add a helper to get user name by id
  const getUserNameById = (userId: string) => {
    const userObj = companyUsers.find(u => u.id === userId);
    if (userObj) return userObj.name || userObj.email || userObj.id;
    return userId;
  };

  const [companyUsers, setCompanyUsers] = useState<SupabaseUser[]>([]);

  // Fetch company users for assignment dropdown
  useEffect(() => {
    const fetchCompanyUsers = async () => {
      if (!user) return;
      // Get user's company_id
      const { data: userRow } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .single();
      if (!userRow?.company_id) return;
      // Fetch all users for this company
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, email, role")
        .eq("company_id", userRow.company_id);
      setCompanyUsers(usersData || []);
    };
    fetchCompanyUsers();
  }, [user]);

  const [shipments, setShipments] = useState<Shipment[]>([]);

  // Fetch shipments for the company
  useEffect(() => {
    const fetchShipments = async () => {
      if (!user) return;
      // Fetch all shipments for this company (filter by company_id)
      const { data: shipmentRows } = await supabase
        .from("shipments")
        .select("*")
        .eq("company_id", user.company_id); // <-- Only fetch for this company
      setShipments(shipmentRows || []);
    };
    fetchShipments();
  }, [user]);

  // Helper: get shipment by id
  const getShipmentById = (id: string | null | undefined) => shipments.find(s => s.id === id);

  return (
    <div className="space-y-8 px-4 md:px-8 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <Button variant="secondary"
          onClick={handleSyncGmail}
          disabled={syncing}
        >
          {syncing && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
          {syncing ? 'Syncing...' : 'Sync Gmail'}
        </Button>
      </div>
      {/* Search input */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          className="w-full md:w-1/2 border rounded px-3 py-2"
          placeholder="Search by subject, body, email, status, etc..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            className="ml-2 border-2 border-gray-400 transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
            variant="secondary"
            onClick={() => setSearchQuery("")}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Channel/account filter summary UI */}
      {channels.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          {channels.map((ch) => (
            <Button
              key={ch.name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border-2 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none ${selectedChannel === ch.name ? 'border-blue-700' : 'border-gray-300'}`}
              onClick={() => {
                setSelectedChannel(ch.name);
                setManuallySelectedChannel(true);
                if (selectedChannel !== ch.name) {
                  setSelectedAccounts(ch.accounts.map((a) => a.id));
                }
              }}
              variant={selectedChannel === ch.name ? "default" : "outline"}
            >
              <span>{ch.label}</span>
              <span className="ml-1 text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">{ch.count}</span>
            </Button>
          ))}
          {/* Account filter for selected channel */}
          {selectedChannel && ((channels.find((c) => c.name === selectedChannel)?.accounts?.length || 0) > 1) && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs font-semibold text-gray-600">Accounts:</span>
              {channels.find((c) => c.name === selectedChannel)?.accounts.map((acc) => (
                <label key={acc.id} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={() => {
                      setManuallySelectedChannel(true);
                      setSelectedAccounts((prev) =>
                        prev.includes(acc.id)
                          ? prev.filter((id) => id !== acc.id)
                          : [...prev, acc.id]
                      );
                    }}
                    className="accent-blue-600"
                  />
                  {acc.label}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>Manage your inbox filters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-left text-muted-foreground text-sm space-y-4">
                <div>
                  <div className="font-semibold mb-2">Categories</div>
                  {categories.length === 0 && (
                    <div className="text-xs">No categories</div>
                  )}
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() =>
                          setSelectedCategories((prev) =>
                            prev.includes(cat)
                              ? prev.filter((c) => c !== cat)
                              : [...prev, cat]
                          )
                        }
                      />
                      {CATEGORY_LABELS[cat] || cat}
                    </label>
                  ))}
                </div>
                <div>
                  <div className="font-semibold mb-2">Countries</div>
                  {countries.length === 0 && (
                    <div className="text-xs">No countries</div>
                  )}
                  {countries.map((country) => (
                    <label key={country} className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(country)}
                        onChange={() =>
                          setSelectedCountries((prev) =>
                            prev.includes(country)
                              ? prev.filter((c) => c !== country)
                              : [...prev, country]
                          )
                        }
                      />
                      {country}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-2">
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              {/* <TabsTrigger value="flagged">Flagged</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger> */}
              <TabsTrigger value="shipments">Shipments</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-accent">
                      <div className="h-[600px] w-full pr-2 custom-scrollbar overflow-y-auto">
                        <ul className="divide-y">
                          {filteredInquiries.map((inquiry) => (
                            <li
                              key={inquiry.id}
                              className={`p-4 border rounded-md cursor-pointer shadow-md hover:bg-gray-200 transition-colors duration-100 flex items-center gap-2 ${
                                selectedInquiry?.id === inquiry.id
                                  ? "bg-gray-30</ul>0"
                                  : inquiry.is_read
                                  ? "bg-white opacity-70"
                                  : "bg-blue-50 border-blue-400"
                              }`}
                              onClick={() => handleSelectInquiry(inquiry)}
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h2 className={`text-base line-clamp-1 ${!inquiry.is_read ? 'font-extrabold text-gray-900' : 'font-normal text-gray-500'}`}>{inquiry.subject}</h2>
                                  {/* Status badge */}
                                  <span
                                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[inquiry.status]}`}
                                    title={STATUS_LABELS[inquiry.status]}
                                  >
                                    {STATUS_LABELS[inquiry.status]}
                                  </span>
                                  {/* Shipment badge */}
                                  {inquiry.shipment_id && (
                                    <span className="ml-2 px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-blue-700 border border-blue-200" title="Shipment Number">
                                      {getShipmentById(inquiry.shipment_id)?.shipment_number || "Shipment"}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm ${inquiry.is_read ? 'text-gray-400' : 'text-muted-foreground'}`}>From: {inquiry.from_email}</p>
                                <p className="text-xs text-gray-400">Received: {new Date(inquiry.received_at).toLocaleString()}</p>
                              </div>
                              {!inquiry.is_read && (
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" title="Unread" />
                              )}
                             
                              <Button
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700 text-white border-none"
                                onClick={e => { e.stopPropagation(); handleDeleteInquiry(inquiry); }}
                                title="Delete Inquiry"
                              >
                                Delete
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="border rounded-xl bg-white min-h-[200px]">
                      {selectedInquiry ? (
                        <div className="p-6 space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h2 className="font-semibold text-lg">{selectedInquiry.subject}</h2>
                            {/* Status dropdown */}
                            <select
                              value={selectedInquiry.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value as Inquiry["status"];
                                await supabase
                                  .from("inquiries")
                                  .update({ status: newStatus })
                                  .eq("id", selectedInquiry.id);
                                setSelectedInquiry((prev) => prev && { ...prev, status: newStatus });
                                setInquiries((prev) => prev.map(i => i.id === selectedInquiry.id ? { ...i, status: newStatus } : i));
                              }}
                              className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[selectedInquiry.status]}`}
                              style={{ minWidth: 120 }}
                            >
                              <option value="new">New</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                          {/* Shipment info and linking */}
                          <div className="mb-2 flex items-center gap-2">
                            <span className="font-semibold">Shipment:</span>
                            {selectedInquiry.shipment_id ? (
                              <span className="text-blue-700 font-mono">{getShipmentById(selectedInquiry.shipment_id)?.shipment_number || 'Unknown'}</span>
                            ) : (
                              <span className="text-gray-400">Unassigned</span>
                            )}
                            
                            <select
                              value={selectedInquiry.shipment_id || ''}
                              onChange={async (e) => {
                                const shipmentId = e.target.value;
                                let newStatus = selectedInquiry.status;
                                if (shipmentId) {
                                  const shipment = shipments.find(s => s.id === shipmentId);
                                  if (shipment && shipment.status) {
                                    newStatus = shipment.status as Inquiry["status"];
                                  }
                                } else {
                                  newStatus = "new";
                                }
                                await supabase
                                  .from('inquiries')
                                  .update({ shipment_id: shipmentId === '' ? null : shipmentId, status: newStatus })
                                  .eq('id', selectedInquiry.id);
                                setSelectedInquiry(prev => prev && { ...prev, shipment_id: shipmentId === '' ? null : shipmentId, status: newStatus });
                                setInquiries(prev => prev.map(i => i.id === selectedInquiry.id ? { ...i, shipment_id: shipmentId === '' ? null : shipmentId, status: newStatus } : i));
                              }}
                              className="ml-2 min-w-[180px] border rounded px-2 py-1"
                            >
                              <option value="">Unassigned</option>
                              {shipments.map(s => (
                                <option key={s.id} value={s.id}>{s.shipment_number}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              // Merge and deduplicate messages by original_id or id
                              const allMessages = [...threadMessages, ...sentThreadMessages];
                              // Build a map of sent_by by original_id from sentThreadMessages
                              const sentByMap = sentThreadMessages.reduce((acc, msg) => {
                                if (msg.original_id && msg.sent_by) {
                                  acc[msg.original_id] = msg.sent_by;
                                }
                                return acc;
                              }, {} as Record<string, string>);
                              const dedupedMessages = allMessages.filter(
                                (msg, idx, arr) =>
                                  arr.findIndex(
                                    m =>
                                      (m.original_id && msg.original_id && m.original_id === msg.original_id) ||
                                      (m.id && msg.id && m.id === msg.id)
                                  ) === idx
                              ).map(msg => {
                                // If this message is from inquiries, but has a sent_by in sent_emails, attach it
                                let sentBy = msg.sent_by;
                                if (!sentBy && msg.original_id && sentByMap[msg.original_id]) {
                                  sentBy = sentByMap[msg.original_id];
                                }
                                return { ...msg, sent_by: sentBy };
                              });
                              return dedupedMessages
                                .sort((a, b) => {
                                  const aDate = a.received_at ?? a.sent_at ?? '';
                                  const bDate = b.received_at ?? b.sent_at ?? '';
                                  return new Date(aDate).getTime() - new Date(bDate).getTime();
                                })
                                .map((msg, idx) => {
                                  const sender = msg.from_email || (user && user.email) || "Me";
                                  const senderName = msg.sent_by ? getUserNameById(msg.sent_by) : null;
                                  return (
                                    <div key={msg.id || msg.original_id || idx} className="border rounded p-2 bg-gray-100">
                                      <p className="text-sm text-muted-foreground">
                                        From: {sender}
                                        {senderName && (
                                          <span className="ml-2 text-xs text-blue-700">(sent by {senderName})</span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        Received: {msg.received_at ? new Date(msg.received_at).toLocaleString() : msg.sent_at ? new Date(msg.sent_at).toLocaleString() : ""}
                                      </p>
                                      <p className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body) }} />
                                    </div>
                                  );
                                });
                            })()}
                          </div>
                          <div className="mt-4 flex gap-2">
                            <textarea
                              className="w-full border rounded p-2"
                              rows={4}
                              placeholder="Type your reply..."
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                            />
                            <div className="flex flex-col gap-2">
                              <Button
                                className="px-4 py-2 border-2 border-blue-600 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                variant="default"
                                onClick={handleReplySubmit}
                                aria-label="Send Reply"
                              >
                                Send Reply
                              </Button>
                              <Button
                                className="px-4 py-2 border-2 border-gray-400 shadow transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
                                variant="secondary"
                                onClick={() => setShowForward(true)}
                                aria-label="Forward"
                              >
                                Forward
                              </Button>
                            </div>
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
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          Select a message to view details
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flagged">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Flagged Messages</CardTitle>
                  <CardDescription>
                    Important messages you&apos;ve flagged for follow-up
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  No flagged messages
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="archived">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Archived Messages</CardTitle>
                  <CardDescription>
                    Messages you&apos;ve processed and archived
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  No archived messages
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipments">
              <ShipmentsManager
                shipments={shipments}
                setShipments={setShipments}
                inquiries={inquiries}
                supabase={supabase as SupabaseClient}
                setInquiries={(inq) => setInquiries(inq as Inquiry[])}
                companyId={user?.company_id || ""} // <-- Pass companyId prop
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Compose modal UI */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-2xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Compose Email</h2>
            <div className="mb-2">
              <label className="block text-sm font-medium">To</label>
              <input
                className="w-full border rounded p-2"
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Subject</label>
              <input
                className="w-full border rounded p-2"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Message</label>
              <textarea
                className="w-full border rounded p-2"
                rows={6}
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                className="px-4 py-2 border-2 border-blue-600 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                variant="default"
                onClick={handleSendEmail}
                disabled={sending}
              >
                {sending ? "Sending..." : "Send"}
              </Button>
              <Button
                className="px-4 py-2 border-2 border-gray-400 shadow transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
                variant="secondary"
                onClick={() => setShowCompose(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal UI */}
      {selectedInquiry && (
        <>
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
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Message (optional)</label>
                  <textarea
                    className="w-full border rounded p-2"
                    rows={3}
                    value={forwardMessage}
                    onChange={e => setForwardMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    className="px-4 py-2 border-2 border-blue-600 shadow-md transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    variant="default"
                    onClick={async () => {
                      if (!selectedInquiry || !forwardTo) return;
                      // Send forward email via API
                      const res = await fetch("/api/gmail/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          emailAccountId: selectedInquiry.email_account_id,
                          to: forwardTo,
                          subject: `Fwd: ${selectedInquiry.subject}`,
                          message: `${forwardMessage ? forwardMessage + '\n\n' : ''}---------- Forwarded message ----------\nFrom: ${selectedInquiry.from_email}\nDate: ${selectedInquiry.received_at}\nSubject: ${selectedInquiry.subject}\n\n${selectedInquiry.body}`,
                          threadId: null, // new thread for forward
                          sentBy: user?.id,
                        }),
                      });
                      if (!res.ok) {
                        alert("Failed to forward email");
                      } else {
                        setShowForward(false);
                        setForwardMessage("");
                        setForwardTo("");
                        // --- Trigger a light Gmail sync (limit 5) ---
                        const prevLimit = localStorage.getItem('gmailFetchLimit');
                        localStorage.setItem('gmailFetchLimit', '5');
                        await handleSyncGmail();
                        if (prevLimit !== null) {
                          localStorage.setItem('gmailFetchLimit', prevLimit);
                        } else {
                          localStorage.removeItem('gmailFetchLimit');
                        }
                        // --- End sync ---
                      }
                    }}
                  >
                    Forward
                  </Button>
                  <Button
                    className="px-4 py-2 border-2 border-gray-400 shadow transition-all duration-150 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-gray-400 focus:outline-none"
                    variant="secondary"
                    onClick={() => setShowForward(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

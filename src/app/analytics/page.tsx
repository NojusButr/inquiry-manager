"use client";

import { useEffect, useState } from "react";
// import { supabase } from "../layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import stringSimilarity from "string-similarity";
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { supabase } from '@/utils/supabase/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface Inquiry {
  id: string;
  received_at: string;
  status: string;
  channel?: string;
  thread_id?: string;
}
interface InquiryCategory {
  inquiry_id: string;
  category: string;
}
interface InquiryCountry {
  inquiry_id: string;
  country: string;
}
interface SentEmail {
  id: string;
  sent_at: string;
  thread_id: string;
  sent_by?: string;
}

export default function AnalyticsPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [categories, setCategories] = useState<InquiryCategory[]>([]);
  const [countries, setCountries] = useState<InquiryCountry[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | "all">("all");
  const [users, setUsers] = useState<{ id: string; name?: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      // 1. Get current user and their company_id
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      const { data: customUser, error: userError } = await supabase
        .from("users")
        .select("id, company_id")
        .eq("auth_id", authUser.id)
        .single();
      if (userError || !customUser?.company_id) {
        setError("User or company not found");
        setLoading(false);
        return;
      }
      // 2. Get all users for this company
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("company_id", customUser.company_id);
      setUsers(usersData || []);
      // 3. Get all email accounts for this company
      const { data: emailAccounts } = await supabase
        .from("email_accounts")
        .select("id")
        .eq("company_id", customUser.company_id);
      const emailAccountIds = (emailAccounts || []).map(ea => ea.id);
      if (emailAccountIds.length === 0) {
        setInquiries([]);
        setCategories([]);
        setCountries([]);
        setSentEmails([]);
        setLoading(false);
        return;
      }
      // 4. Get all inquiries for these email accounts
      const { data: inquiriesData } = await supabase
        .from("inquiries")
        .select("id, received_at, status, assigned_to, thread_id, from_email, subject, body, channel, email_account_id")
        .in("email_account_id", emailAccountIds);
      setInquiries(inquiriesData || []);
      const inquiryIds = (inquiriesData || []).map(i => i.id);
      // 5. Get all inquiry_categories and inquiry_countries for these inquiries
      const { data: catData } = await supabase
        .from("inquiry_categories")
        .select("inquiry_id, category")
        .in("inquiry_id", inquiryIds);
      setCategories(catData || []);
      const { data: countryData } = await supabase
        .from("inquiry_countries")
        .select("inquiry_id, country")
        .in("inquiry_id", inquiryIds);
      setCountries(countryData || []);
      // 6. Get all sent_emails for these threads
      const threadIds = (inquiriesData || []).map(i => i.thread_id).filter(Boolean);
      const { data: sentData } = await supabase
        .from("sent_emails")
        .select("id, sent_at, thread_id, sent_by")
        .in("thread_id", threadIds);
      setSentEmails(sentData || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Group by month, quarter, category, country
  const stats = getInquiryStats(inquiries, categories, countries);

  // Sort months and quarters chronologically
  const sortedMonths = Object.entries(stats.byMonth).sort(([a], [b]) => a.localeCompare(b));
  const sortedQuarters = Object.entries(stats.byQuarter).sort(([a], [b]) => a.localeCompare(b));
  // Top categories and countries (descending)
  const topCategories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCountries = Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // Preferred channels
  const channelCounts: Record<string, number> = {};
  for (const inq of inquiries) {
    const channel = inq.channel || 'email';
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  }
  const sortedChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);

  // Average response time calculation
  function getAvgResponseTime(userId: string | "all") {
    if (userId === "all") {
      // Compute per-user average, then average those
      const userIds = users.map(u => u.id);
      const userAverages: number[] = [];
      for (const uid of userIds) {
        const ms = getAvgResponseTimeMs(uid);
        if (ms !== null) userAverages.push(ms);
      }
      if (userAverages.length === 0) return null;
      const avgMs = userAverages.reduce((a, b) => a + b, 0) / userAverages.length;
      return formatMs(avgMs);
    } else {
      const ms = getAvgResponseTimeMs(userId);
      return ms === null ? null : formatMs(ms);
    }
  }
  // Helper: get avg response time in ms for a user
  function getAvgResponseTimeMs(userId: string) {
    let totalMs = 0;
    let count = 0;
    for (const inq of inquiries) {
      const replies = sentEmails.filter(se => se.thread_id === inq.thread_id && se.sent_by === userId);
      if (replies.length === 0) continue;
      const firstReply = replies.reduce((min, curr) =>
        new Date(curr.sent_at) < new Date(min.sent_at) ? curr : min
      );
      const received = new Date(inq.received_at).getTime();
      const replied = new Date(firstReply.sent_at).getTime();
      if (replied > received) {
        totalMs += replied - received;
        count++;
      }
    }
    if (count === 0) return null;
    return totalMs / count;
  }
  // Helper: format ms to h m s
  function formatMs(avgMs: number) {
    const hours = Math.floor(avgMs / 3600000);
    const minutes = Math.floor((avgMs % 3600000) / 60000);
    const seconds = Math.floor((avgMs % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  const avgResponseTime = getAvgResponseTime(selectedUser);
  // Totals
  const totalInquiries = inquiries.length;

  // Prepare chart data
  const monthLabels = sortedMonths.map(([month]) => month);
  const monthCounts = sortedMonths.map(([, count]) => count);
  const categoryLabels = topCategories.map(([cat]) => cat);
  const categoryCounts = topCategories.map(([, count]) => count);
  const countryLabels = topCountries.map(([country]) => country);
  const countryCounts = topCountries.map(([, count]) => count);
  const channelLabels = sortedChannels.map(([ch]) => ch);
  const channelCountsArr = sortedChannels.map(([, count]) => count);

  // Calculate month-over-month change
  let monthChange: { percent: number; direction: 'up' | 'down' | 'none' } = { percent: 0, direction: 'none' };
  if (monthLabels.length >= 2) {
    const last = monthCounts[monthCounts.length - 1];
    const prev = monthCounts[monthCounts.length - 2];
    if (prev > 0) {
      const percent = ((last - prev) / prev) * 100;
      monthChange = {
        percent: Math.abs(percent),
        direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'none',
      };
    } else if (last > 0) {
      monthChange = { percent: 100, direction: 'up' };
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardHeader><CardTitle>Total Inquiries</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalInquiries}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Preferred Channel</CardTitle></CardHeader>
              <CardContent>
                {sortedChannels.length > 0 ? (
                  <div className="text-lg font-bold">{sortedChannels[0][0]}</div>
                ) : (
                  <div className="text-gray-400">No data</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Category</CardTitle></CardHeader>
              <CardContent>
                {topCategories.length > 0 ? (
                  <div className="text-lg font-bold">{topCategories[0][0]}</div>
                ) : (
                  <div className="text-gray-400">No data</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Country Mention</CardTitle></CardHeader>
              <CardContent>
                {topCountries.length > 0 ? (
                  <div className="text-lg font-bold">{topCountries[0][0]}</div>
                ) : (
                  <div className="text-gray-400">No data</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Avg. Response Time</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <span className="text-lg font-bold">{avgResponseTime ?? "N/A"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">User:</span>
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={selectedUser}
                      onChange={e => setSelectedUser(e.target.value)}
                    >
                      <option value="all">All</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Graphs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader><CardTitle>Inquiries by Month</CardTitle></CardHeader>
              <CardContent>
                <Bar
                  data={{
                    labels: monthLabels,
                    datasets: [
                      {
                        label: 'Inquiries',
                        data: monthCounts,
                        backgroundColor: '#2563eb',
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      title: { display: false },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
                    },
                  }}
                  height={220}
                />
                {monthLabels.length >= 2 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-sm font-semibold ${monthChange.direction === 'up' ? 'text-green-600' : monthChange.direction === 'down' ? 'text-red-600' : 'text-gray-500'}`}>{monthChange.direction === 'up' ? '▲' : monthChange.direction === 'down' ? '▼' : ''} {monthChange.percent.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500">vs previous month</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Inquiries by Channel</CardTitle></CardHeader>
              <CardContent>
                <Pie
                  data={{
                    labels: channelLabels,
                    datasets: [
                      {
                        label: 'Inquiries',
                        data: channelCountsArr,
                        backgroundColor: [
                          '#2563eb', '#f59e42', '#10b981', '#f43f5e', '#6366f1', '#fbbf24', '#a3e635', '#f472b6', '#38bdf8', '#eab308',
                        ],
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'bottom' },
                      title: { display: false },
                    },
                  }}
                  height={220}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Categories</CardTitle></CardHeader>
              <CardContent>
                <Bar
                  data={{
                    labels: categoryLabels,
                    datasets: [
                      {
                        label: 'Inquiries',
                        data: categoryCounts,
                        backgroundColor: categoryLabels.map((_, i) => [
                          '#2563eb', '#f59e42', '#10b981', '#f43f5e', '#6366f1', '#fbbf24', '#a3e635', '#f472b6', '#38bdf8', '#eab308',
                        ][i % 10]),
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      title: { display: false },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
                    },
                  }}
                  height={220}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Country Mentions</CardTitle></CardHeader>
              <CardContent>
                <Pie
                  data={{
                    labels: countryLabels,
                    datasets: [
                      {
                        label: 'Mentions',
                        data: countryCounts,
                        backgroundColor: [
                          '#10b981', '#f43f5e', '#6366f1', '#fbbf24', '#a3e635', '#f472b6', '#38bdf8', '#eab308', '#2563eb', '#f59e42',
                        ],
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'bottom' },
                      title: { display: false },
                    },
                  }}
                  height={220}
                />
              </CardContent>
            </Card>
          </div>
          {/* Monthly analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Inquiries by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {sortedMonths.map(([month, count]) => (
                  <li key={month} className="mb-1">
                    <span className="font-mono">{month}</span>: <span className="font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {/* Channel breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Inquiries by Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {sortedChannels.map(([channel, count]) => (
                  <li key={channel} className="mb-1">
                    <span className="font-mono">{channel}</span>: <span className="font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {/* Top categories */}
          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {topCategories.map(([cat, count]) => (
                  <li key={cat} className="mb-1">
                    <span className="font-mono">{cat}</span>: <span className="font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {/* Top country mentions */}
          <Card>
            <CardHeader>
              <CardTitle>Top Country Mentions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {topCountries.map(([country, count]) => (
                  <li key={country} className="mb-1">
                    <span className="font-mono">{country}</span>: <span className="font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {/* Quarterly analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Inquiries by Quarter</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {sortedQuarters.map(([quarter, count]) => (
                  <li key={quarter} className="mb-1">
                    <span className="font-mono">{quarter}</span>: <span className="font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {/* Frequently Asked Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {(() => {
                  // Extract and count questions from inquiry bodies
                  const rawQuestions: string[] = [];
                  for (const inq of inquiries) {
                    // @ts-expect-error: body is present in the select but not in the interface
                    const body = inq.body || '';
                    // Remove HTML tags
                    const plain = body.replace(/<[^>]*>/g, ' ');
                    // Split into sentences (keep ? as a delimiter)
                    const sentences = plain.split(/(?<=\?)|[\n]+/);
                    for (let s of sentences) {
                      s = s.trim();
                      if (s.endsWith('?')) {
                        const normalized = s.replace(/\s+/g, ' ').replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9?]+$/g, '').toLowerCase();
                        // Exclude if contains URL or domain
                        if (/https?:\/\//.test(normalized) || /www\.|\.com|\.lt|\.net|\.org|\.io/.test(normalized)) continue;
                        // Exclude if too short or too long
                        if (normalized.length < 10 || normalized.length > 150) continue;
                        // Exclude if too few words
                        if (normalized.split(' ').length < 3) continue;
                        // Exclude if mostly non-letters (less than 50% letters)
                        const letterCount = (normalized.match(/[a-zA-Z]/g) || []).length;
                        if (letterCount / normalized.length < 0.5) continue;
                        rawQuestions.push(normalized);
                      }
                    }
                  }
                  // Fuzzy grouping
                  const groups: { rep: string; count: number; members: string[] }[] = [];
                  const threshold = 0.3;
                  for (const q of rawQuestions) {
                    let found = false;
                    for (const group of groups) {
                      const sim = stringSimilarity.compareTwoStrings(q, group.rep);
                      if (sim >= threshold) {
                        group.count++;
                        group.members.push(q);
                        found = true;
                        break;
                      }
                    }
                    if (!found) {
                      groups.push({ rep: q, count: 1, members: [q] });
                    }
                  }
                  // For each group, pick the most 'central' (abstract) question as rep
                  for (const group of groups) {
                    if (group.members.length === 1) continue;
                    let bestIdx = 0;
                    let bestScore = -Infinity;
                    for (let i = 0; i < group.members.length; i++) {
                      let score = 0;
                      for (let j = 0; j < group.members.length; j++) {
                        if (i === j) continue;
                        score += stringSimilarity.compareTwoStrings(group.members[i], group.members[j]);
                      }
                      // Prefer shorter questions in case of tie
                      score += 0.001 * (1 - group.members[i].length / 200);
                      if (score > bestScore) {
                        bestScore = score;
                        bestIdx = i;
                      }
                    }
                    group.rep = group.members[bestIdx];
                  }
                  // Sort by count desc, show top 10
                  return groups
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .map((group, idx) => {
                      // Capitalize first letter of representative
                      const displayQuestion = group.rep.charAt(0).toUpperCase() + group.rep.slice(1);
                      const isOpen = openFaqIdx === idx;
                      return (
                        <li key={displayQuestion + idx} className="mb-4 flex flex-col gap-1">
                          <button
                            className="flex items-start gap-3 w-full text-left focus:outline-none"
                            onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                            aria-expanded={isOpen}
                          >
                            <span className="block font-mono text-xs text-gray-700 bg-gray-100 rounded p-2 max-w-xl overflow-x-auto flex-1">
                              {displayQuestion}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 whitespace-nowrap self-center">
                              <span className="font-bold text-base text-gray-700 mr-1">{group.count}</span>
                              <span>times</span>
                            </span>
                            <span className="ml-2 text-xs self-center">{isOpen ? '▲' : '▼'}</span>
                          </button>
                          {isOpen && (
                            <div className="ml-2 mt-2 bg-gray-50 border border-gray-200 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">Grouped questions ({group.members.length}):</div>
                              <ul className="list-disc pl-5">
                                {group.members.map((q, i) => (
                                  <li key={q + i} className="text-xs text-gray-700 mb-1 font-mono">{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      );
                    });
                })()}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function getInquiryStats(
  inquiries: Inquiry[],
  categories: InquiryCategory[],
  countries: InquiryCountry[]
) {
  const byMonth: Record<string, number> = {};
  const byQuarter: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  for (const inq of inquiries) {
    const date = new Date(inq.received_at);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const quarter = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    byMonth[month] = (byMonth[month] || 0) + 1;
    byQuarter[quarter] = (byQuarter[quarter] || 0) + 1;
  }
  // Count by category (many-to-many)
  for (const cat of categories) {
    byCategory[cat.category] = (byCategory[cat.category] || 0) + 1;
  }
  // Count by country (many-to-many)
  for (const c of countries) {
    byCountry[c.country] = (byCountry[c.country] || 0) + 1;
  }
  return { byMonth, byQuarter, byCategory, byCountry };
}

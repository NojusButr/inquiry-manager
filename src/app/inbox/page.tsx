"use client";

import { useState, useEffect } from "react";
import { supabase } from "../layout";
import "../globals.css";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Inquiry {
  id: number;
  subject: string;
  from_email: string;
  received_at: string;
}

interface SupabaseUser {
  id: string;
  email: string;
  [key: string]: string | number | boolean | null | undefined;
}

export default function Inbox() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const fetchUserAndInbox = async () => {
      try {
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !authUser) {
          console.error("Error fetching auth user:", userError);
          return;
        }

        const { data: customUser, error: customUserError } = await supabase
          .from("users")
          .select("id, email")
          .eq("auth_id", authUser.id)
          .single();

        if (customUserError) {
          console.error("Error fetching custom user:", customUserError);
          return;
        }

        setUser(customUser);

        const res = await fetch("/api/gmail/fetch");
        const result = await res.json();

        if (result.error) {
          console.error(result.error);
        } else {
          const { data, error: inquiriesError } = await supabase
            .from("inquiries")
            .select("*");
          if (inquiriesError) {
            console.error(inquiriesError.message);
          } else {
            setInquiries(data || []);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user or inbox:", error);
      }
    };

    fetchUserAndInbox();
  }, []);

  return (
    <div className="space-y-8 px-4 md:px-8 py-6">
      {user && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Authenticated User</CardTitle>
            <CardDescription>Currently signed-in user details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>Manage your inbox filters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-muted-foreground text-sm">
                Filter options will go here
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-accent ">
                      <ul className="divide-y">
                        {inquiries.map((inquiry) => (
                          <li
                          key={inquiry.id}
                          className="p-10 border rounded-md cursor-pointer shadow-md hover:bg-gray-200"
                          onClick={() => setSelectedInquiry(inquiry)}
                          >
                            <div className="space-y-1">
                              <h2 className="font-semibold text-base text-gray-900 line-clamp-1">
                                {inquiry.subject}
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                From: {inquiry.from_email}
                              </p>
                              <p className="text-xs text-gray-400">
                                Received:{" "}
                                {new Date(inquiry.received_at).toLocaleString()}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border rounded-xl bg-white min-h-[200px]">
                      {selectedInquiry ? (
                        <div className="p-6 space-y-2">
                          <h2 className="font-semibold text-lg">
                            {selectedInquiry.subject}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            From: {selectedInquiry.from_email}
                          </p>
                          <p className="text-xs text-gray-400">
                            Received:{" "}
                            {new Date(
                              selectedInquiry.received_at
                            ).toLocaleString()}
                          </p>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}

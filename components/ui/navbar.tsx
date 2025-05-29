"use client";

import * as React from "react";
// import { supabase } from '@/app/layout';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
// import { createClient } from '@/utils/supabase/client';

// const supabase = createClient();
import { supabase } from '@/utils/supabase/client';

export default function Navbar() {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setLoggedIn(!!user);
      if (user) {
        // Fetch the user's role from the users table
        const { data: customUser } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', user.id)
          .single();
        setUserRole(customUser?.role || null);
      } else {
        setUserRole(null);
      }
    };
    checkAuth();
  }, []);

  if (!loggedIn) return null;

  return (
    <div className="w-full bg-gray-100 border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="/inbox" className={navigationMenuTriggerStyle()}>
                Inbox
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="/analytics" className={navigationMenuTriggerStyle()}>
                Analytics
              </NavigationMenuLink>
            </NavigationMenuItem>
            {userRole === 'admin' && (
              <NavigationMenuItem>
                <NavigationMenuLink href="/team" className={navigationMenuTriggerStyle()}>
                  Team Management
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <div className="flex items-center gap-4 ml-auto">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="/settings/emails" className={navigationMenuTriggerStyle()}>
                Settings
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        {/* Logout button, only if logged in */}
        {loggedIn && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition ml-2"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

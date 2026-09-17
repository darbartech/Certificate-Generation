import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

// Development helper (not for production).
//
//   npx tsx --env-file=.env scripts/seedDevAdmins.ts
//
// Creates DB-backed `admin` (super_admin) and `staff` accounts from the
// ADMIN_PASSWORD / STAFF_PASSWORD already present in .env, so local logins use
// the normal persistent-session path instead of the env fallback (whose
// non-UUID ids cannot satisfy admin_sessions.admin_user_id references).

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fail = (message: string): never => {
  console.error(`[seed:admins] ${message}`);
  process.exit(1);
};

if (!url || !serviceKey) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");

const accounts = [
  { username: "admin", role: "super_admin", password: process.env.ADMIN_PASSWORD },
  { username: "staff", role: "staff", password: process.env.STAFF_PASSWORD },
].filter((a) => {
  if (!a.password) {
    console.warn(`[seed:admins] Skipping "${a.username}": password env not set.`);
    return false;
  }
  return true;
});

const supabase = createClient(url!, serviceKey!);

const run = async () => {
  for (const account of accounts) {
    const password_hash = await bcrypt.hash(account.password!, 12);

    const { data: existing, error: lookupError } = await supabase
      .from("admin_users")
      .select("id, username")
      .ilike("username", account.username)
      .maybeSingle();
    if (lookupError) fail(`Lookup failed for "${account.username}": ${lookupError.message}`);

    if (existing) {
      const { error } = await supabase
        .from("admin_users")
        .update({
          password_hash,
          role: account.role,
          permissions: {},
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) fail(`Update failed for "${account.username}": ${error.message}`);
      console.log(`[seed:admins] Updated ${account.role} "${account.username}" (${existing.id}).`);
      continue;
    }

    const { data: created, error: insertError } = await supabase
      .from("admin_users")
      .insert({
        username: account.username,
        password_hash,
        role: account.role,
        permissions: {},
        is_active: true,
      })
      .select("id, username, role")
      .single();
    if (insertError) fail(`Create failed for "${account.username}": ${insertError.message}`);
    console.log(`[seed:admins] Created ${created!.role} "${created!.username}" (${created!.id}).`);
  }
};

void run();

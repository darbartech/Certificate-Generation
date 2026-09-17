import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

// V2 §15 production bootstrap.
//
//   npm run bootstrap:admin
//
// Creates (or resets) the first SUPER_ADMIN in the `admin_users` table from
// environment values. No default credentials are ever shipped: if the required
// variables are missing the script refuses to run.
//
// Required env (add to .env.local or export before running):
//   ADMIN_BOOTSTRAP_USERNAME   e.g. owner@darbartech.example
//   ADMIN_BOOTSTRAP_PASSWORD   12+ characters, generated and stored in a vault
//
// Optional:
//   ADMIN_BOOTSTRAP_ROLE       super_admin (default) | admin | staff
//   ADMIN_BOOTSTRAP_RESET      "true" to overwrite the password of an existing user

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const role = (process.env.ADMIN_BOOTSTRAP_ROLE || "super_admin").trim();
const reset = process.env.ADMIN_BOOTSTRAP_RESET === "true";

const fail = (message: string): never => {
  console.error(`[bootstrap:admin] ${message}`);
  process.exit(1);
};

if (!url || !serviceKey) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
if (!username) fail("ADMIN_BOOTSTRAP_USERNAME must be set.");
if (!password || password.length < 12) {
  fail("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters long.");
}
if (!["super_admin", "admin", "staff"].includes(role)) {
  fail(`ADMIN_BOOTSTRAP_ROLE must be super_admin, admin or staff (got "${role}").`);
}

const supabase = createClient(url!, serviceKey!);

const fullPermissions = {
  create: true,
  preview: true,
  issue: true,
  revoke: true,
  download: true,
  manageTemplates: true,
};

const run = async () => {
  const hash = await bcrypt.hash(password!, 12);

  const { data: existing, error: lookupError } = await supabase
    .from("admin_users")
    .select("id, username")
    .ilike("username", username!)
    .maybeSingle();
  if (lookupError) fail(`Lookup failed: ${lookupError.message}`);

  if (existing) {
    if (!reset) {
      console.log(
        `[bootstrap:admin] "${existing.username}" already exists (${existing.id}). ` +
          "Re-run with ADMIN_BOOTSTRAP_RESET=true to reset its password."
      );
      return;
    }
    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash: hash, role, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) fail(`Reset failed: ${error.message}`);
    console.log(`[bootstrap:admin] Password reset for "${existing.username}" (${existing.id}).`);
    return;
  }

  const { data: created, error: insertError } = await supabase
    .from("admin_users")
    .insert({
      id: crypto.randomUUID(),
      username: username!,
      password_hash: hash,
      role,
      permissions: fullPermissions,
      is_active: true,
    })
    .select("id, username, role")
    .single();
  if (insertError) fail(`Create failed: ${insertError.message}`);
  if (!created) fail("Create returned no row.");

  console.log(`[bootstrap:admin] Created ${created!.role} "${created!.username}" (${created!.id}).`);
};

void run();

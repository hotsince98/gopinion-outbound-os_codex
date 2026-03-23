import { seedSupabaseCoreEntities } from "../lib/data/postgres/seed";

async function main() {
  const counts = await seedSupabaseCoreEntities({
    provider: "supabase",
  });

  console.log("Seeded Supabase core operational entities:");
  console.log(`- companies: ${counts.companies}`);
  console.log(`- contacts: ${counts.contacts}`);
  console.log(`- campaigns: ${counts.campaigns}`);
  console.log(`- replies: ${counts.replies}`);
  console.log(`- appointments: ${counts.appointments}`);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown seed failure";

  console.error(`Supabase seed failed: ${message}`);
  process.exitCode = 1;
});

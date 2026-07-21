const { execSync } = require("child_process");

function checkEnv(varName, minLen) {
  const val = process.env[varName];
  if (!val || val.length < minLen) {
    console.error(`❌ ${varName} missing or too short (got ${val?.length ?? 0}, need ${minLen})`);
    return false;
  }
  // Detect placeholder strings
  if (val.includes("...")) {
    console.error(`❌ ${varName} contains placeholder "..." — real key required`);
    return false;
  }
  console.log(`✅ ${varName} = ${val.length} chars`);
  return true;
}

let ok = true;
ok = checkEnv("NEXT_PUBLIC_SUPABASE_URL", 10) && ok;
ok = checkEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", 100) && ok;
ok = checkEnv("SUPABASE_SERVICE_ROLE_KEY", 100) && ok;
ok = checkEnv("OPENROUTER_API_KEY", 20) && ok;
ok = checkEnv("NEXT_PUBLIC_APP_URL", 10) && ok;

if (!ok) {
  process.exit(1);
}

console.log("\n✅ All required env vars present and non-placeholder.");

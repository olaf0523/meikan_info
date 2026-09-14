import { readFile } from "node:fs/promises";
import path from "node:path";
import FreelancerDirectory from "@/components/FreelancerDirectory";
import type { FreelancerSummary } from "@/lib/freelancer";

export default async function Page() {
  // scripts/build-data.mjs が CSV から生成する (npm run dev / build の前に自動実行)
  const file = path.join(process.cwd(), "data", "freelancers.json");
  const freelancers: FreelancerSummary[] = JSON.parse(await readFile(file, "utf8"));

  return <FreelancerDirectory freelancers={freelancers} />;
}

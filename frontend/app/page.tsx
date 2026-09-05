import { getSnapshot } from "@/lib/api";
import Dashboard from "./dashboard";

export default async function Home() {
  const snapshot = await getSnapshot();

  return <Dashboard initialSnapshot={snapshot} />;
}

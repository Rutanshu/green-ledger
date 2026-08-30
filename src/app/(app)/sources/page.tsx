import { redirect } from "next/navigation";

// Data Collection Setup (redesign spec §01) is one nav item over three
// existing screens (Factor Lab, Builder, Position library) rather than a
// full rewrite into a single page — see SourcesTabs, rendered at the top
// of each of those three pages, for how they stay connected.
export default function SourcesPage() {
  redirect("/factor-lab");
}

import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to notes page
  redirect("/notes");
}
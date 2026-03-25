import { redirect } from "next/navigation";

// Registration is only available via invitation links
// This page redirects to login as a safety measure
export default function RegisterPage() {
  redirect("/login");
}

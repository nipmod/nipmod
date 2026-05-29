import type { Metadata } from "next";
import { createPageMetadata } from "../metadata";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  ...createPageMetadata({
    description: "Private Nipmod operator dashboard for API, archive and beta key metrics.",
    path: "/admin",
    title: "Nipmod Admin"
  }),
  robots: {
    follow: false,
    index: false
  }
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <AdminDashboard />;
}

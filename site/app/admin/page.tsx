import { createPageMetadata } from "../metadata";
import { AdminDashboard } from "./admin-dashboard";

export const metadata = createPageMetadata({
  description: "Private Nipmod operator dashboard for API, archive and beta key metrics.",
  path: "/admin",
  title: "Nipmod Admin"
});

export default function AdminPage() {
  return <AdminDashboard />;
}

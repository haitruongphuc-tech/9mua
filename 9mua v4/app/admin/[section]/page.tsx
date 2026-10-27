import AdminDashboard from "@/components/AdminDashboard";

// /admin/users, /admin/kiots, /admin/value, /admin/ai-cost, /admin/slogan, /admin/legal
export default function AdminSectionPage({ params }: { params: { section: string } }) {
  return <AdminDashboard section={params.section} />;
}

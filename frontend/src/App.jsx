import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const InchargeDashboard = lazy(() => import("./pages/InchargeDashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));

function homeForRole(role) {
  if (role === "lab_incharge") return "/incharge";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/dashboard";
}

function PageLoading() {
  return <main className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">Loading LabVault…</main>;
}

function ProtectedRoute({ allowedRoles }) {
  const { token, user } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <><Navbar /><Outlet /></>;
}

function PublicOnly({ children }) {
  const { token, user } = useAuth();
  if (token && user) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["admin", "super_admin"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["lab_incharge"]} />}>
          <Route path="/incharge" element={<InchargeDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

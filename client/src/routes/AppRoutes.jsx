import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoadingSpinner } from '../components/LoadingSpinner';

const Landing = lazy(() => import('../pages/Landing').then((module) => ({ default: module.Landing })));
const Analysis = lazy(() => import('../pages/Analysis').then((module) => ({ default: module.Analysis })));
const Report = lazy(() => import('../pages/Report').then((module) => ({ default: module.Report })));
const ReportDetails = lazy(() => import('../pages/ReportDetails').then((module) => ({ default: module.ReportDetails })));
const Login = lazy(() => import('../pages/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('../pages/Register').then((module) => ({ default: module.Register })));
const VerifyEmail = lazy(() => import('../pages/VerifyEmail').then((module) => ({ default: module.VerifyEmail })));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const Dashboard = lazy(() => import('../pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const CompareReports = lazy(() => import('../pages/CompareReports').then((module) => ({ default: module.CompareReports })));
const SharedReport = lazy(() => import('../pages/SharedReport').then((module) => ({ default: module.SharedReport })));

const RouteLoadingFallback = () => (
  <div className="page-shell flex min-h-[60vh] items-center justify-center">
    <div className="card flex items-center gap-3 px-6 py-5 text-slate-600 dark:text-slate-300">
      <LoadingSpinner size="md" />
      Loading page...
    </div>
  </div>
);

export const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/shared/:shareToken" element={<SharedReport />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analysis"
          element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report/:jobId"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <ProtectedRoute>
              <ReportDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <CompareReports />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

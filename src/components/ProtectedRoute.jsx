import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLoader } from 'react-icons/fi';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isLoggedIn, isSubscriptionActive, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  // 1. Show a loading spinner while the auth state is being determined.
  // This prevents flickering between login/dashboard pages on reload.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-900">
        <FiLoader className="text-4xl text-yellow-400 animate-spin" />
      </div>
    );
  }

  // 2. If not logged in, redirect to the login page.
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If this route is for admins only, check for admin status.
  if (adminOnly && !isAdmin) {
      // If a non-admin tries to access, send them to the dashboard.
      return <Navigate to="/" replace />;
  }

  // 4. For regular users, check subscription status.
  // Allow access to /plan and /settings regardless of subscription.
  const isAllowedWithoutSubscription = location.pathname === '/plan' || location.pathname === '/settings';
  
  if (!isSubscriptionActive && !isAllowedWithoutSubscription && !isAdmin) {
    // If subscription is inactive and the page is not on the allowed list, redirect to the plan page.
    return <Navigate to="/plan" state={{ from: location }} replace />;
  }

  // 5. If all checks pass, render the requested component.
  return children;
};

export default ProtectedRoute;
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'; // Outlet add kiya hai
import { SettingsProvider } from './context/SettingsContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ShopSettings from './pages/ShopSettings';
import POSView from './pages/POSView';
import { FiMenu } from 'react-icons/fi';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext'; 
import ViewPlan from './pages/ViewPlan';
import { ToastContainer } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';
import SalesHistory from './pages/SalesHistory';
import Analysis from './pages/Analysis';
import ManageStock from './pages/ManageStock';
import { PurchaseProvider } from './context/PurchaseContext';
import AdminDashboard from './pages/AdminDashboard';

// 1. Layout Component banaya hai jisme Sidebar rahega
const MainLayout = ({ isSidebarOpen, toggleSidebar }) => {
  return (
    <div className="relative flex h-screen overflow-hidden bg-stone-900">
      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto transition-all duration-300">
        {/* Header for Mobile with Hamburger Menu */}
        <div className="md:hidden flex items-center justify-between p-4 bg-black/30 backdrop-blur-lg sticky top-0 z-30 border-b border-purple-500/20">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
            GM Pos
          </h1>
          <button onClick={toggleSidebar} className="text-yellow-300 hover:text-pink-400 transition-colors">
            <FiMenu size={26} />
          </button>
        </div>

        {/* Yaha par baaki pages load honge */}
        <Outlet />
      </main>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        ></div>
      )}
    </div>
  );
};

function App() {
  const [cart, setCart] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const ComingSoon = ({ pageName }) => (
    <div className="flex items-center justify-center h-full p-4">
      <h1 className="text-4xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
        {pageName} - Coming Soon!
      </h1>
    </div>
  );

  return (
    <AuthProvider>
      <SettingsProvider>
        <PurchaseProvider>
          <Router>
            <ToastContainer
              position="top-right"
              autoClose={1000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
            
            <Routes>
              {/* 
                  ---------------------------------------------------------
                  1. ADMIN DASHBOARD (Ye Layout se bahar hai, No Sidebar)
                  ---------------------------------------------------------
              */}
              <Route path="/admin-dashboard-chicken-pos" element={<AdminDashboard />} />

              {/* 
                  ---------------------------------------------------------
                  2. LOGIN PAGE (Isko bhi sidebar se bahar rakh sakte hain)
                  ---------------------------------------------------------
              */}
              <Route path="/login" element={<LoginPage />} />

              {/* 
                  ---------------------------------------------------------
                  3. MAIN LAYOUT ROUTES (In sabme Sidebar dikhega)
                  ---------------------------------------------------------
              */}
              <Route element={<MainLayout isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />}>
                <Route path="/" element={<Dashboard cart={cart} setCart={setCart} />} />
                <Route path="/pos-view" element={<POSView cart={cart} setCart={setCart} />} />
                <Route path="/settings" element={<ShopSettings />} />
                <Route path="/plan" element={<ViewPlan />} />
                <Route path="/manage-stock" element={<ManageStock />} />
                <Route path="/sales" element={<SalesHistory />} />
                <Route path="/products" element={<ComingSoon pageName="Manage Products" />} />
                <Route path="/analysis" element={<Analysis />} />
                
                {/* 404 Page inside layout */}
                <Route 
                  path="*" 
                  element={
                    <div className="flex items-center justify-center h-full p-4">
                      <h1 className="text-4xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
                        404 - Page Not Found
                      </h1>
                    </div>
                  } 
                />
              </Route>
            </Routes>

          </Router>
        </PurchaseProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
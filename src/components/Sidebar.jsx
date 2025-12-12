import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom'; // 1. useNavigate import
import { 
  FiGrid, 
  FiSettings, 
  FiX, 
  FiFileText, 
  FiBarChart2,
  FiArchive,
  FiLogOut
} from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
// import { toast } from 'react-toastify'; // Toast ki zarurat kam hai logout me

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout } = useAuth(); 
  const navigate = useNavigate(); // 2. Hook Initialize

  const menuItems = [
    { name: 'Dashboard', icon: <FiGrid />, path: '/' },
    { name: 'Plan', icon: <FaRupeeSign />, path: '/plan' },
    { name: 'History', icon: <FiFileText />, path: '/sales' },
    { name: 'Inventory', icon: <FiArchive />, path: '/manage-stock' },
    { name: 'Analysis', icon: <FiBarChart2 />, path: '/analysis' },
    { name: 'Setting', icon: <FiSettings />, path: '/settings' },
  ];

  const baseLinkClasses = "flex items-center p-3 rounded-xl mx-2 transition-all duration-300";
  const inactiveLinkClasses = "text-gray-300 hover:bg-purple-500/20 hover:text-yellow-300";
  const activeLinkClasses = "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/30";

  // =========================================================
  // UPDATED LOGOUT FUNCTION
  // =========================================================
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      try {
        // Appwrite se session delete karne ki koshish karo
        await logout(); 
      } catch (error) {
        // Agar session pehle hi expire hai (Guest error), toh ignore karo
        console.warn("Logout error (likely already logged out):", error);
      } finally {
        // SUCCESS HO YA FAIL - User ko login page par bhejo
        navigate('/login');
      }
    }
  };

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50
        w-64 bg-black/40 backdrop-blur-2xl border-r border-purple-500/30
        flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}
    >
      <div>
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h1 className="text-xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {user?.shopName || 'GM Pos'}
          </h1>
          <button onClick={toggleSidebar} className="text-gray-300 hover:text-white md:hidden">
            <FiX size={24} />
          </button>
        </div>
        <nav className="p-2 mt-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  onClick={() => { if(isOpen) toggleSidebar(); }}
                  className={({ isActive }) => 
                    `${baseLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`
                  }
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="ml-4">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="p-4 border-t border-white/20">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center p-3 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors duration-300"
        >
          <FiLogOut className="text-2xl" />
          <span className="ml-4 font-semibold">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
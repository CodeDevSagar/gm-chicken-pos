import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'react-toastify';
import { 
    FiPlus, FiTrendingUp, FiLoader, 
    FiShoppingBag, FiUsers, FiDollarSign, 
    FiArrowRight, FiEdit2, FiTrash2, FiX, FiCheckCircle, FiClock, FiCalendar, FiRefreshCw
} from 'react-icons/fi';

// --- APPWRITE IMPORTS ---
import { databases, account, AppwriteConfig } from '../appwrite/config';
import { ID, Query } from 'appwrite';

const ManageStock = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  // --- STATE ---
  const [localPurchases, setLocalPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState('stock'); 
  const [editingId, setEditingId] = useState(null); // Common ID for both edit types

  // Forms
  const [stockForm, setStockForm] = useState({ productId: '', weight: '', costPerKg: '' });
  const [salaryForm, setSalaryForm] = useState({ employeeName: '', amount: '', note: '' });

  // --- 1. INITIALIZE & FETCH DATA ---
  useEffect(() => {
      loadInitialData();
  }, []);

  const loadInitialData = async () => {
      setIsLoading(true);
      try {
          // 1. User ID nikalo (Saving ke liye zaroori hai)
          try {
              const user = await account.get();
              setCurrentUserId(user.$id);
          } catch (e) {
              console.warn("User not logged in or guest mode");
          }

          // 2. Data Fetch karo (Limit badha di hai 1000 tak)
          await refreshData();

      } catch (error) {
          console.error("❌ Init Error:", error);
          toast.error("Error loading data");
      } finally {
          setIsLoading(false);
      }
  };

  // --- REFRESH DATA FUNCTION ---
  const refreshData = async () => {
      try {
        const response = await databases.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.purchasesCollectionId,
            [
                Query.orderDesc('$createdAt'), 
                Query.limit(1000) // 🔥 Increased limit to show old data
            ]
        );
        console.log("✅ Data Loaded:", response.documents);
        setLocalPurchases(response.documents);
      } catch(e) { 
          console.error("Fetch Error:", e);
      }
  };

  // --- PRODUCTS LIST ---
  const productList = useMemo(() => Object.values(settings.products || {}), [settings.products]);

  // Auto-select first product
  useEffect(() => {
    if (productList.length > 0 && !stockForm.productId) {
        setStockForm(prev => ({ ...prev, productId: productList[0].id }));
    }
  }, [settings.products, productList, stockForm.productId]);

  // --- MAIN SAVE FUNCTION ---
  const saveData = async (data, docId = null) => {
      if (!navigator.onLine) return toast.error("Offline: Cannot save.");
      
      // Safety Check
      if (!currentUserId) {
          try {
              const user = await account.get(); // Retry getting user
              setCurrentUserId(user.$id);
              data.userId = user.$id;
          } catch (e) {
              toast.error("Please Login to save data.");
              return false;
          }
      } else {
          data.userId = currentUserId;
      }

      try {
          if (docId) {
              // UPDATE
              await databases.updateDocument(AppwriteConfig.databaseId, AppwriteConfig.purchasesCollectionId, docId, data);
              toast.success("Record Updated Successfully!");
          } else {
              // CREATE
              await databases.createDocument(AppwriteConfig.databaseId, AppwriteConfig.purchasesCollectionId, ID.unique(), data);
              toast.success("Record Added Successfully!");
          }
          return true;
      } catch (error) {
          console.error("Save Error:", error);
          toast.error("Save Failed: " + error.message);
          return false;
      }
  };

  // --- HANDLERS ---
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    const wt = parseFloat(stockForm.weight);
    const cost = parseFloat(stockForm.costPerKg);

    if (!stockForm.productId || !wt || !cost) return toast.error("Invalid values.");

    const selectedProduct = settings.products[stockForm.productId];
    const newEntry = {
      purchaseDate: new Date().toISOString(),
      type: 'stock', 
      productId: stockForm.productId,
      productName: selectedProduct ? selectedProduct.name : "Unknown Product",
      weight: wt,
      costPerKg: cost,
      totalCost: wt * cost,
    };

    if (await saveData(newEntry, editingId)) {
        cancelEdit();
        refreshData();
    }
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(salaryForm.amount);
    if (!salaryForm.employeeName || !amt) return toast.error("Invalid details.");

    const salaryData = {
        purchaseDate: new Date().toISOString(), 
        type: 'salary',
        employeeName: salaryForm.employeeName,
        totalCost: amt,
        productName: 'Salary Payment', // Required for UI consistency
        note: salaryForm.note || '',
    };

    if (await saveData(salaryData, editingId)) {
        cancelEdit();
        refreshData();
    }
  };

  // --- EDIT HANDLER (For Both Stock & Salary) ---
  const handleEditClick = (record) => {
      setEditingId(record.$id);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (record.type === 'stock') {
          setActiveTab('stock');
          setStockForm({
              productId: record.productId, // Note: might need handling if product deleted
              weight: record.weight,
              costPerKg: record.costPerKg
          });
      } else {
          setActiveTab('salary');
          setSalaryForm({
              employeeName: record.employeeName,
              amount: record.totalCost,
              note: record.note || ''
          });
      }
  };

  // --- DELETE HANDLER (Database Delete) ---
  const handleDeleteClick = async (id) => {
      if (!window.confirm("Are you sure you want to delete this record permanently?")) return;
      
      try {
          await databases.deleteDocument(AppwriteConfig.databaseId, AppwriteConfig.purchasesCollectionId, id);
          toast.success("Record Deleted from Database.");
          setLocalPurchases(prev => prev.filter(item => item.$id !== id)); // Instant UI update
      } catch (error) {
          console.error(error);
          toast.error("Delete failed: " + error.message);
      }
  };
  
  const cancelEdit = () => {
      setEditingId(null);
      setStockForm(prev => ({ ...prev, weight: '', costPerKg: '' })); // Keep product ID
      setSalaryForm({ employeeName: '', amount: '', note: '' });
  };

  // --- FILTERS & TOTALS ---
  const stockHistory = localPurchases.filter(p => (p.type || '').toLowerCase() === 'stock');
  const salaryHistory = localPurchases.filter(p => (p.type || '').toLowerCase() === 'salary');

  const totalStockInvestment = stockHistory.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);
  const totalSalaryPaid = salaryHistory.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 pb-24 font-sans">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Expense Manager
        </h1>
        <p className="text-slate-400">Manage Inventory & Payroll</p>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-center md:justify-start">
          <div className="bg-slate-800 p-1 rounded-xl inline-flex shadow-lg border border-slate-700">
              <button 
                onClick={() => { setActiveTab('stock'); cancelEdit(); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                  <FiShoppingBag /> Stock
              </button>
              <button 
                onClick={() => { setActiveTab('salary'); cancelEdit(); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'salary' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                  <FiUsers /> Salaries
              </button>
          </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: FORM SECTION */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
             {/* Background Decoration */}
             <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-20 ${activeTab === 'stock' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>

             <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    {activeTab === 'stock' ? <FiShoppingBag className="text-indigo-400"/> : <FiUsers className="text-emerald-400"/>}
                    {editingId ? 'Edit Record' : (activeTab === 'stock' ? 'New Stock' : 'New Salary')}
                </h2>
                {editingId && (
                    <button onClick={cancelEdit} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                        <FiX /> Cancel
                    </button>
                )}
             </div>

             {activeTab === 'stock' ? (
                 <form onSubmit={handleStockSubmit} className="space-y-4 relative z-10">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Product</label>
                        <select 
                            value={stockForm.productId} 
                            onChange={e => setStockForm({...stockForm, productId: e.target.value})} 
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {productList.length === 0 && <option value="">No Products Found</option>}
                            {productList.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Weight (KG)</label>
                            <input type="number" step="0.01" value={stockForm.weight} onChange={e => setStockForm({...stockForm, weight: e.target.value})} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cost / KG</label>
                            <input type="number" step="0.01" value={stockForm.costPerKg} onChange={e => setStockForm({...stockForm, costPerKg: e.target.value})} placeholder="₹ 0.00" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                    <button type="submit" className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                        {editingId ? <><FiCheckCircle /> Update Stock</> : <><FiPlus /> Add Stock</>}
                    </button>
                 </form>
             ) : (
                 <form onSubmit={handleSalarySubmit} className="space-y-4 relative z-10">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Employee Name</label>
                        <input type="text" value={salaryForm.employeeName} onChange={e => setSalaryForm({...salaryForm, employeeName: e.target.value})} placeholder="Name" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Amount (₹)</label>
                        <input type="number" step="0.01" value={salaryForm.amount} onChange={e => setSalaryForm({...salaryForm, amount: e.target.value})} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Note</label>
                        <input type="text" value={salaryForm.note} onChange={e => setSalaryForm({...salaryForm, note: e.target.value})} placeholder="Optional" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <button type="submit" className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        {editingId ? <><FiCheckCircle /> Update Salary</> : <><FiDollarSign /> Record Payment</>}
                    </button>
                 </form>
             )}
          </div>
          
          {/* Stats Box */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex items-center gap-5">
             <div className={`p-4 rounded-2xl ${activeTab === 'stock' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                <FiTrendingUp className={`text-3xl ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`} />
             </div>
             <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total {activeTab === 'stock' ? 'Investment' : 'Paid'}</p>
                <p className="text-3xl font-bold text-white mt-1">₹{(activeTab === 'stock' ? totalStockInvestment : totalSalaryPaid).toLocaleString('en-IN')}</p>
             </div>
          </div>
        </div>

        {/* RIGHT: HISTORY LIST */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col h-full min-h-[600px]">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FiClock className="text-slate-400" /> Recent History
                </h2>
                <button onClick={refreshData} className="flex items-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-all">
                    <FiRefreshCw /> Refresh
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                        <FiLoader className="animate-spin text-3xl mb-2" /> 
                        <p>Loading records...</p>
                    </div>
                ) : (activeTab === 'stock' ? stockHistory : salaryHistory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <div className="bg-slate-800 p-4 rounded-full mb-3 opacity-50">
                            {activeTab === 'stock' ? <FiShoppingBag size={32}/> : <FiUsers size={32}/>}
                        </div>
                        <p>No records found.</p>
                        <p className="text-xs mt-1 opacity-70">If data exists, check Refresh button.</p>
                    </div>
                ) : (
                    (activeTab === 'stock' ? stockHistory : salaryHistory).map(p => (
                        <div key={p.$id} className={`bg-slate-700/30 border border-slate-700/50 p-4 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between group transition-all ${editingId === p.$id ? 'border-amber-500/50 bg-amber-500/5' : 'hover:bg-slate-700/50'}`}>
                            
                            {/* Record Info */}
                            <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                                <div className={`p-3 rounded-xl ${activeTab === 'stock' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                                    <FiCalendar className={activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'} />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-lg">
                                        {activeTab === 'stock' ? (p.productName || "Unknown") : (p.employeeName || "Employee")}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <span>{new Date(p.purchaseDate || p.$createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        {p.note && (
                                            <>
                                                <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                                                <span className="text-emerald-300 italic max-w-[150px] truncate">{p.note}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions & Cost */}
                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                    <p className={`font-bold text-lg ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                        ₹{(Number(p.totalCost) || 0).toFixed(2)}
                                    </p>
                                    {activeTab === 'stock' && (
                                        <p className="text-xs text-slate-500 font-mono">
                                            {p.weight}kg @ ₹{p.costPerKg}
                                        </p>
                                    )}
                                </div>

                                {/* EDIT & DELETE BUTTONS (Visible on Hover or Mobile) */}
                                <div className="flex items-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEditClick(p)} 
                                        className="p-2 bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Edit"
                                    >
                                        <FiEdit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(p.$id)} 
                                        className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Delete Permanently"
                                    >
                                        <FiTrash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManageStock;
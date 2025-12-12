import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { usePurchases } from '../context/PurchaseContext';
import { toast } from 'react-toastify';
import { 
    FiPlus, FiTrendingUp, FiCalendar, FiLoader, 
    FiShoppingBag, FiUsers, FiDollarSign, 
    FiArrowRight, FiEdit2, FiTrash2, FiX, FiCheckCircle, FiClock
} from 'react-icons/fi';

import { AppwriteConfig } from '../appwrite/config';
import { saveRecord, syncOfflineData, getCombinedData } from "../utils/OfflineManager";

const ManageStock = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  // --- GET CONTEXT FUNCTIONS ---
  const { purchases, updatePurchase, deletePurchase, isLoading } = usePurchases();

  const [activeTab, setActiveTab] = useState('stock'); 
  const [stockForm, setStockForm] = useState({ productId: '', weight: '', costPerKg: '' });
  const [salaryForm, setSalaryForm] = useState({ employeeName: '', amount: '', note: '' });
  const [editingSalaryId, setEditingSalaryId] = useState(null); 

  // --- LOCAL STATE FOR INSTANT UPDATES ---
  // Jab online add karein, toh turant dikhane ke liye ye temporary list hai
  const [tempOnlineItems, setTempOnlineItems] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auto-select first product
  useEffect(() => {
    if (productList.length > 0 && !stockForm.productId) {
        setStockForm(prev => ({ ...prev, productId: productList[0].id }));
    }
  }, [settings.products]);

  const productList = useMemo(() => Object.values(settings.products || {}), [settings.products]);

  // --- SYNC & RELOAD LOGIC (THE FIX) ---
  useEffect(() => {
    // 1. Check for sync on load
    syncOfflineData();

    // 2. Listen for Internet Connection
    const handleOnline = async () => {
        toast.info("Connecting to Server...");
        await syncOfflineData();
        toast.success("Sync Complete! Refreshing...");
        
        // 🔥 MAGIC FIX: Sync hone ke baad page reload karein taaki totals sahi ho jayein
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // --- MERGE ALL DATA (Context + Offline + Temp Online) ---
  const allPurchases = useMemo(() => {
      // 1. Get Context Data (Server)
      // 2. Get Offline Data (Local)
      const offlineAndContext = getCombinedData(purchases, 'purchases');
      
      // 3. Merge with Temporary Online Items (Jo abhi add kiye par context me nahi aaye)
      const finalData = [...tempOnlineItems, ...offlineAndContext];

      // 4. Sort by Date
      return finalData.sort((a, b) => {
          const dateA = new Date(a.purchaseDate || a.$createdAt);
          const dateB = new Date(b.purchaseDate || b.$createdAt);
          return dateB - dateA;
      });
  }, [purchases, refreshTrigger, tempOnlineItems]);

  // --- CALCULATE TOTALS ---
  const stockHistory = allPurchases.filter(p => p.type === 'stock');
  const salaryHistory = allPurchases.filter(p => p.type === 'salary');

  const totalStockInvestment = stockHistory.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);
  const totalSalaryPaid = salaryHistory.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);

  // --- STOCK HANDLER ---
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    const wt = parseFloat(stockForm.weight);
    const cost = parseFloat(stockForm.costPerKg);

    if (!stockForm.productId || !wt || wt <= 0 || !cost || cost <= 0) {
        return toast.error("Invalid values.");
    }

    const selectedProduct = settings.products[stockForm.productId];
    if (!selectedProduct) return toast.error("Product not found.");

    const newEntry = {
      purchaseDate: new Date().toISOString(),
      type: 'stock', 
      productId: stockForm.productId,
      productName: selectedProduct.name,
      weight: wt,
      costPerKg: cost,
      totalCost: wt * cost,
      userId: settings.userId
    };

    try {
        const targetCollectionId = AppwriteConfig.purchasesCollectionId || "purchases";
        
        // Save (Online or Offline)
        const result = await saveRecord(targetCollectionId, newEntry);
        
        // Clear Form
        setStockForm({ ...stockForm, weight: '', costPerKg: '' });

        // 🔥 UI UPDATE: Agar Online save hua, to turant list me dikhao
        if (result.mode === 'online') {
            setTempOnlineItems(prev => [result.data, ...prev]);
        } else {
            // Agar offline hua to OfflineManager handle kar lega via refreshTrigger
            setRefreshTrigger(prev => prev + 1);
        }
        
        toast.success(`Stock Added ${result.mode === 'offline' ? '(Offline)' : ''}`);
    } catch (error) {
        console.error(error);
        toast.error("Failed to add stock.");
    }
  };

  // --- SALARY HANDLERS ---
  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(salaryForm.amount);

    if (!salaryForm.employeeName.trim() || !amt || amt <= 0) {
        return toast.error("Invalid details.");
    }

    const salaryData = {
        purchaseDate: new Date().toISOString(), 
        type: 'salary',
        employeeName: salaryForm.employeeName,
        totalCost: amt,
        productName: 'Salary Payment',
        note: salaryForm.note || '',
        userId: settings.userId
    };

    try {
        if (editingSalaryId) {
            if (!navigator.onLine) return toast.error("Edit needs internet.");
            
            // Check if item is offline
            const isOfflineItem = allPurchases.find(p => p.$id === editingSalaryId)?.isOffline;
            if (isOfflineItem) return toast.warn("Wait for sync before editing.");

            try {
                await updatePurchase(editingSalaryId, salaryData);
                toast.success(`Salary record updated.`);
                cancelEdit();
                setRefreshTrigger(prev => prev + 1);
            } catch(e) {
                toast.error("Update failed. Check Permissions.");
            }
        } 
    } catch (error) {
        console.error(error);
        toast.error("Failed to save salary.");
    }
  };

  const handleEditClick = (record) => {
      setEditingSalaryId(record.$id);
      setSalaryForm({
          employeeName: record.employeeName,
          amount: record.totalCost,
          note: record.note || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
      setEditingSalaryId(null);
      setSalaryForm({ employeeName: '', amount: '', note: '' });
  };

  const handleDeleteClick = async (id) => {
      // 1. Check Internet
      if (!navigator.onLine) return toast.error("Delete requires internet connection.");

      // 2. Check if Offline Item (Can't delete until synced)
      const isOfflineItem = allPurchases.find(p => p.$id === id)?.isOffline;
      if (isOfflineItem) return toast.warn("Wait for sync to complete before deleting.");

      if (window.confirm("Are you sure you want to delete this record?")) {
          try {
              await deletePurchase(id);
              toast.success("Record deleted successfully.");
              
              if (editingSalaryId === id) cancelEdit();
              
              // Remove from temp list if it exists there
              setTempOnlineItems(prev => prev.filter(i => i.$id !== id));
              
              // Trigger UI refresh
              setRefreshTrigger(prev => prev + 1); 
          } catch (error) {
              console.error(error);
              toast.error("Failed to delete record. Check permissions.");
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 pb-24 font-sans">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Expense Manager
        </h1>
        <p className="text-slate-400">Track your inventory purchases and employee payrolls.</p>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-center md:justify-start">
          <div className="bg-slate-800 p-1 rounded-xl inline-flex shadow-lg border border-slate-700">
              <button 
                onClick={() => { setActiveTab('stock'); cancelEdit(); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                  <FiShoppingBag /> Stock Purchases
              </button>
              <button 
                onClick={() => setActiveTab('salary')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'salary' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                  <FiUsers /> Staff Salaries
              </button>
          </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: ENTRY FORM */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
             <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-20 ${activeTab === 'stock' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>

             <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    {activeTab === 'stock' ? <FiShoppingBag className="text-indigo-400"/> : <FiUsers className="text-emerald-400"/>}
                    {activeTab === 'stock' ? 'New Stock Entry' : (editingSalaryId ? 'Edit Salary Record' : 'Record Salary Payment')}
                </h2>
                {editingSalaryId && activeTab === 'salary' && (
                    <button onClick={cancelEdit} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded">
                        <FiX /> Cancel
                    </button>
                )}
             </div>

             {activeTab === 'stock' ? (
                 <>
                 {productList.length === 0 ? (
                    <div className="text-center py-6 relative z-10">
                        <p className="text-slate-400 mb-4 text-sm">You haven't added any products yet.</p>
                        <button onClick={() => navigate('/settings')} className="w-full bg-slate-700 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            Go to Settings & Add Product <FiArrowRight />
                        </button>
                    </div>
                 ) : (
                     <form onSubmit={handleStockSubmit} className="space-y-4 relative z-10">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Product</label>
                            <select 
                                value={stockForm.productId} 
                                onChange={e => setStockForm({...stockForm, productId: e.target.value})} 
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {productList.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Weight (KG)</label>
                                <input type="number" step="0.01" value={stockForm.weight} onChange={e => setStockForm({...stockForm, weight: e.target.value})} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Cost / KG</label>
                                <input type="number" step="0.01" value={stockForm.costPerKg} onChange={e => setStockForm({...stockForm, costPerKg: e.target.value})} placeholder="₹ 0.00" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all transform active:scale-95 flex items-center justify-center gap-2">
                            <FiPlus /> Add Stock
                        </button>
                     </form>
                 )}
                 </>
             ) : (
                 <form onSubmit={handleSalarySubmit} className="space-y-4 relative z-10">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Employee Name</label>
                        <input 
                            type="text"
                            value={salaryForm.employeeName} 
                            onChange={e => setSalaryForm({...salaryForm, employeeName: e.target.value})} 
                            placeholder="John Doe" 
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Amount (₹)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                            <input 
                                type="number" step="0.01" 
                                value={salaryForm.amount} 
                                onChange={e => setSalaryForm({...salaryForm, amount: e.target.value})} 
                                placeholder="0.00" 
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Note (Optional)</label>
                        <input 
                            type="text"
                            value={salaryForm.note} 
                            onChange={e => setSalaryForm({...salaryForm, note: e.target.value})} 
                            placeholder="e.g. Advance / Bonus" 
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>
                    
                    <button type="submit" className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${editingSalaryId ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'}`}>
                        {editingSalaryId ? <><FiCheckCircle /> Update Payment</> : <><FiDollarSign /> Record Payment</>}
                    </button>
                 </form>
             )}
          </div>

          {/* Stats Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex items-center gap-5">
            <div className={`p-4 rounded-2xl ${activeTab === 'stock' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                <FiTrendingUp className={`text-3xl ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`} />
            </div>
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Total {activeTab === 'stock' ? 'Investment' : 'Salaries Paid'}
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                    ₹{(activeTab === 'stock' ? totalStockInvestment : totalSalaryPaid).toLocaleString('en-IN')}
                </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORY LIST */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col h-full min-h-[500px]">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 pb-4 border-b border-slate-700/50">
            <FiClock className="text-slate-400" /> Recent History
          </h2>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {isLoading ? (
               <div className="flex justify-center items-center h-full text-slate-500">
                   <FiLoader className="animate-spin text-3xl mr-3" /> Loading records...
               </div>
            ) : (activeTab === 'stock' ? stockHistory : salaryHistory).length === 0 ? (
               <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                   <div className="bg-slate-800 p-4 rounded-full mb-3">
                       {activeTab === 'stock' ? <FiShoppingBag size={32}/> : <FiUsers size={32}/>}
                   </div>
                   <p>No records found.</p>
               </div>
            ) : (
                (activeTab === 'stock' ? stockHistory : salaryHistory).map(p => (
                    <div key={p.$id} className={`bg-slate-700/30 border border-slate-700/50 p-4 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between group transition-all ${editingSalaryId === p.$id ? 'border-amber-500/50 bg-amber-500/5' : 'hover:bg-slate-700/50'}`}>
                        
                        {/* Info Section */}
                        <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                            <div className={`p-3 rounded-xl ${activeTab === 'stock' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                                <FiCalendar className={activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'} />
                            </div>
                            <div>
                                <p className="font-bold text-white text-lg">
                                    {activeTab === 'stock' ? (p.productName || "Unknown Product") : (p.employeeName || "Employee")}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                    <span>{new Date(p.purchaseDate || p.$createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    {p.isOffline && (
                                        <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1 rounded border border-orange-500/30">Offline</span>
                                    )}
                                    {p.note && (
                                        <>
                                            <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                                            <span className="text-emerald-300 italic max-w-[150px] truncate">{p.note}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Amount & Actions Section */}
                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-right">
                                <p className={`font-bold text-lg ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                    ₹{(Number(p.totalCost) || 0).toFixed(2)}
                                </p>
                                {activeTab === 'stock' && (
                                    <p className="text-xs text-slate-500 font-mono">
                                        {(p.weight || 0).toFixed(3)}kg @ ₹{(p.costPerKg || 0).toFixed(0)}
                                    </p>
                                )}
                            </div>

                            {/* Edit/Delete Buttons */}
                            {activeTab === 'salary' && (
                                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEditClick(p)} 
                                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Edit"
                                        disabled={p.isOffline} 
                                    >
                                        <FiEdit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(p.$id)} 
                                        className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Delete"
                                        disabled={p.isOffline}
                                    >
                                        <FiTrash2 size={16} />
                                    </button>
                                </div>
                            )}
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
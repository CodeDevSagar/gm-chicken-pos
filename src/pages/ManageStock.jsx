import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'react-toastify';
import { 
    FiPlus, FiTrendingUp, FiLoader, FiShoppingBag, FiUsers, FiDollarSign, 
    FiEdit3, FiTrash2, FiX, FiCheck, FiCalendar, FiRefreshCw, FiSearch, FiFilter,FiArrowRight
} from 'react-icons/fi';

// --- APPWRITE SDK ---
import { Client, Databases, Account, ID, Query } from 'appwrite';
import { AppwriteConfig } from '../appwrite/config'; 

// ==============================================================
// ⚠️ IMPORTANT: AGAR CONFIG FILE KAAM NA KARE, TOH YAHAN ID DAALO
// ==============================================================
const MY_CONFIG = {
    // Koshish karein config file se lene ki, nahi toh string use karein
    ENDPOINT: AppwriteConfig.endpoint || 'https://cloud.appwrite.io/v1',
    PROJECT_ID: AppwriteConfig.projectId,
    DATABASE_ID: AppwriteConfig.databaseId, 
    COLLECTION_ID: AppwriteConfig.purchasesCollectionId // <-- Yahan ID paste karein agar error aaye
};

// --- INITIALIZE APPWRITE LOCALLY (To fix missing import issues) ---
const client = new Client().setEndpoint(MY_CONFIG.ENDPOINT).setProject(MY_CONFIG.PROJECT_ID);
const databases = new Databases(client);
const account = new Account(client);

const ManageStock = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  // --- STATES ---
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'salary'
  const [editId, setEditId] = useState(null);

  // Forms
  const [stockData, setStockData] = useState({ productId: '', weight: '', costPerKg: '' });
  const [salaryData, setSalaryData] = useState({ employeeName: '', amount: '', note: '' });

  // --- 1. LOAD DATA & USER ---
  useEffect(() => {
      checkConfigAndLoad();
  }, []);

  const checkConfigAndLoad = async () => {
      if (!MY_CONFIG.DATABASE_ID || !MY_CONFIG.COLLECTION_ID) {
          toast.error("MISSING IDs: Please check MY_CONFIG at top of code.");
          setLoading(false);
          return;
      }
      
      try {
          // Get User
          const user = await account.get();
          setUserId(user.$id);
          
          // Get Data
          await fetchData();
      } catch (error) {
          console.error("Init Error:", error);
          if(error.code === 401) {
              toast.warn("Guest Mode: Data saving might fail.");
          }
      } finally {
          setLoading(false);
      }
  };

  const fetchData = async () => {
      try {
          const response = await databases.listDocuments(
              MY_CONFIG.DATABASE_ID, 
              MY_CONFIG.COLLECTION_ID, 
              [Query.orderDesc('$createdAt'), Query.limit(500)]
          );
          setDataList(response.documents);
      } catch (error) {
          toast.error("Failed to load history.");
      }
  };

  // --- 2. SAVE HANDLER (Unified) ---
  const handleSave = async (e, type) => {
      e.preventDefault();
      if (!navigator.onLine) return toast.error("Offline: Cannot save.");
      
      let payload = {};

      if (type === 'stock') {
          const wt = parseFloat(stockData.weight);
          const cost = parseFloat(stockData.costPerKg);
          if (!stockData.productId || !wt || !cost) return toast.error("Fill all stock fields");
          
          const prod = settings.products[stockData.productId];
          payload = {
              type: 'stock',
              productId: stockData.productId,
              productName: prod ? prod.name : 'Unknown',
              weight: wt,
              costPerKg: cost,
              totalCost: wt * cost,
              purchaseDate: new Date().toISOString()
          };
      } else {
          const amt = parseFloat(salaryData.amount);
          if (!salaryData.employeeName || !amt) return toast.error("Fill all salary fields");
          
          payload = {
              type: 'salary',
              employeeName: salaryData.employeeName,
              totalCost: amt,
              productName: 'Salary', // Required field fallback
              note: salaryData.note || '',
              purchaseDate: new Date().toISOString()
          };
      }

      // Add User ID
      if (userId) payload.userId = userId;

      try {
          if (editId) {
              await databases.updateDocument(MY_CONFIG.DATABASE_ID, MY_CONFIG.COLLECTION_ID, editId, payload);
              toast.success(`${type === 'stock' ? 'Stock' : 'Salary'} Updated!`);
          } else {
              await databases.createDocument(MY_CONFIG.DATABASE_ID, MY_CONFIG.COLLECTION_ID, ID.unique(), payload);
              toast.success(`${type === 'stock' ? 'Stock' : 'Salary'} Added!`);
          }
          
          resetForms();
          fetchData();
      } catch (error) {
          console.error(error);
          toast.error("Save Failed: " + error.message);
      }
  };

  // --- 3. DELETE HANDLER ---
  const handleDelete = async (id) => {
      if (!window.confirm("⚠️ Are you sure? This will be permanently deleted.")) return;
      
      try {
          // Optimistic UI Update (Turant gayab karo list se)
          setDataList(prev => prev.filter(item => item.$id !== id));
          
          await databases.deleteDocument(MY_CONFIG.DATABASE_ID, MY_CONFIG.COLLECTION_ID, id);
          toast.success("Deleted Successfully");
      } catch (error) {
          toast.error("Delete Failed");
          fetchData(); // Rollback if failed
      }
  };

  // --- 4. EDIT HANDLER ---
  const handleEdit = (item) => {
      setEditId(item.$id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      if (item.type === 'stock') {
          setActiveTab('stock');
          setStockData({
              productId: item.productId,
              weight: item.weight,
              costPerKg: item.costPerKg
          });
      } else {
          setActiveTab('salary');
          setSalaryData({
              employeeName: item.employeeName,
              amount: item.totalCost,
              note: item.note
          });
      }
  };

  const resetForms = () => {
      setEditId(null);
      setStockData(prev => ({ ...prev, weight: '', costPerKg: '' }));
      setSalaryData({ employeeName: '', amount: '', note: '' });
  };

  // --- HELPERS ---
  const productList = useMemo(() => Object.values(settings.products || {}), [settings.products]);
  
  // Filter Data for UI
  const filteredList = dataList.filter(item => (item.type || '').toLowerCase() === activeTab);
  const totalAmount = filteredList.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);

  // Auto Select Product
  useEffect(() => {
    if (activeTab === 'stock' && productList.length > 0 && !stockData.productId) {
        setStockData(prev => ({ ...prev, productId: productList[0].id }));
    }
  }, [activeTab, productList]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 pb-24 font-sans selection:bg-indigo-500/30">
      
      {/* 1. TOP HEADER */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
                Expense Manager
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Track Inventory & Payrolls</p>
        </div>
        
        {/* Toggle Tabs */}
        <div className="bg-slate-800/80 p-1.5 rounded-2xl flex shadow-xl border border-slate-700/50 backdrop-blur-md">
            <button 
                onClick={() => { setActiveTab('stock'); resetForms(); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'stock' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-105' : 'text-slate-400 hover:text-white'}`}
            >
                <FiShoppingBag className="text-lg"/> Stock
            </button>
            <button 
                onClick={() => { setActiveTab('salary'); resetForms(); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'salary' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-105' : 'text-slate-400 hover:text-white'}`}
            >
                <FiUsers className="text-lg"/> Salary
            </button>
        </div>
      </header>

      {/* 2. MAIN GRID */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: FORM (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
            <div className={`relative overflow-hidden bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl transition-all ${editId ? 'ring-2 ring-amber-500/50' : ''}`}>
                
                {/* Background Glow */}
                <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${activeTab === 'stock' ? 'from-indigo-600/20' : 'from-emerald-600/20'} to-transparent rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none`}></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {editId ? <FiEdit3 className="text-amber-400"/> : (activeTab === 'stock' ? <FiPlus className="text-indigo-400"/> : <FiDollarSign className="text-emerald-400"/>)}
                        {editId ? 'Edit Entry' : `Add ${activeTab === 'stock' ? 'Stock' : 'Salary'}`}
                    </h2>
                    {editId && <button onClick={resetForms} className="text-xs bg-slate-700/50 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 px-3 py-1 rounded-full transition-colors flex items-center gap-1 border border-transparent hover:border-rose-500/30"><FiX/> Cancel</button>}
                </div>

                {activeTab === 'stock' ? (
                    <form onSubmit={(e) => handleSave(e, 'stock')} className="space-y-5 relative z-10">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 ml-1">SELECT PRODUCT</label>
                            <div className="relative">
                                <select 
                                    value={stockData.productId} 
                                    onChange={e => setStockData({...stockData, productId: e.target.value})} 
                                    className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all appearance-none"
                                >
                                    {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <FiSearch className="absolute right-4 top-4 text-slate-500 pointer-events-none"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">WEIGHT (KG)</label>
                                <input type="number" step="0.01" value={stockData.weight} onChange={e => setStockData({...stockData, weight: e.target.value})} className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all font-mono" placeholder="0.00" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">COST / KG</label>
                                <input type="number" step="0.01" value={stockData.costPerKg} onChange={e => setStockData({...stockData, costPerKg: e.target.value})} className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all font-mono" placeholder="₹ 0.00" />
                            </div>
                        </div>
                        <button type="submit" className={`w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all ${editId ? 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-900/30' : 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-indigo-900/30'}`}>
                            {editId ? 'Update Stock' : 'Add Stock Entry'} <FiArrowRight/>
                        </button>
                    </form>
                ) : (
                    <form onSubmit={(e) => handleSave(e, 'salary')} className="space-y-5 relative z-10">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 ml-1">EMPLOYEE NAME</label>
                            <input type="text" value={salaryData.employeeName} onChange={e => setSalaryData({...salaryData, employeeName: e.target.value})} className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all" placeholder="Enter name..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 ml-1">AMOUNT (₹)</label>
                            <input type="number" step="0.01" value={salaryData.amount} onChange={e => setSalaryData({...salaryData, amount: e.target.value})} className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all font-mono" placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 ml-1">NOTE (OPTIONAL)</label>
                            <input type="text" value={salaryData.note} onChange={e => setSalaryData({...salaryData, note: e.target.value})} className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 text-white rounded-xl py-3.5 px-4 outline-none transition-all" placeholder="Bonus, Advance etc." />
                        </div>
                        <button type="submit" className={`w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all ${editId ? 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-900/30' : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/30'}`}>
                            {editId ? 'Update Salary' : 'Record Payment'} <FiCheck/>
                        </button>
                    </form>
                )}
            </div>

            {/* Total Card */}
            <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 flex items-center justify-between shadow-lg">
                <div>
                    <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Total {activeTab}</p>
                    <p className={`text-3xl font-black mt-1 ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        ₹{totalAmount.toLocaleString('en-IN')}
                    </p>
                </div>
                <div className={`p-4 rounded-full ${activeTab === 'stock' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <FiTrendingUp size={24}/>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: LIST (8 Cols) */}
        <div className="lg:col-span-8">
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl h-[650px] flex flex-col">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FiCalendar className="text-slate-400"/> 
                        {activeTab === 'stock' ? 'Stock History' : 'Payroll History'}
                    </h3>
                    <button onClick={fetchData} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Refresh">
                        <FiRefreshCw className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                            <FiLoader className="animate-spin text-3xl"/>
                            <p>Loading data...</p>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-2xl opacity-50">
                                <FiFilter />
                            </div>
                            <p>No records found.</p>
                        </div>
                    ) : (
                        filteredList.map(item => (
                            <div key={item.$id} className={`group relative bg-slate-700/20 hover:bg-slate-700/40 border border-slate-700/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 ${editId === item.$id ? 'border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/5' : ''}`}>
                                
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg ${activeTab === 'stock' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {activeTab === 'stock' ? item.productName?.charAt(0) : item.employeeName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-200 text-lg">
                                            {activeTab === 'stock' ? item.productName : item.employeeName}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                                                {new Date(item.purchaseDate || item.$createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short'})}
                                            </span>
                                            {item.note && <span className="text-emerald-400/80 italic">• {item.note}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                    <div className="text-right">
                                        <div className={`text-lg font-black ${activeTab === 'stock' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                            ₹{Number(item.totalCost).toLocaleString('en-IN')}
                                        </div>
                                        {activeTab === 'stock' && (
                                            <div className="text-xs text-slate-500 font-mono">
                                                {item.weight}kg × ₹{item.costPerKg}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons (Always visible on mobile, hover on desktop) */}
                                    <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity translate-x-2 sm:translate-x-0">
                                        <button 
                                            onClick={() => handleEdit(item)}
                                            className="p-2 bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-lg"
                                        >
                                            <FiEdit3 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(item.$id)}
                                            className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors shadow-lg"
                                        >
                                            <FiTrash2 size={16}/>
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
    </div>
  );
};

export default ManageStock;
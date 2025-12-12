import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiCalendar, 
  FiFileText, 
  FiChevronDown, 
  FiChevronUp, 
  FiClock, 
  FiLoader,
  FiCreditCard,   // Added for Online
  FiDollarSign    // Added for Cash
} from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { databases, AppwriteConfig, Query } from '../appwrite/config';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { getCombinedData } from '../utils/OfflineManager';


const getLocalDateKey = (isoDateString) => {
  if (!isoDateString) return "Unknown Date";
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) return "Unknown Date";
    return date.toISOString().split("T")[0];
  } catch (e) {
    return "Unknown Date";
  }
};

const SalesHistory = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);

  // --- FUNCTION: Fetch Data with Stability Fixes ---
  const fetchAllDocuments = async (userId) => {
    let allDocuments = [];
    let lastId = null;
    const batchSize = 100; 

    try {
      while (true) {
        let queries = [
          Query.orderDesc('$createdAt'),
          Query.limit(batchSize)
        ];

        if (lastId) {
          queries.push(Query.cursorAfter(lastId));
        }

        const response = await databases.listDocuments(
          AppwriteConfig.databaseId,
          AppwriteConfig.salesCollectionId,
          queries
        );

        if (response.documents.length === 0) break;

        const userBatch = response.documents.filter(doc => {
            const docUser = doc.userId || doc.userid || doc.user_id || doc.User_id;
            return docUser === userId;
        });

        allDocuments = [...allDocuments, ...userBatch];

        if (response.documents.length < batchSize) break;

        const lastDoc = response.documents[response.documents.length - 1];
        if (lastDoc) {
            lastId = lastDoc.$id;
        } else {
            break; 
        }
      }
      return allDocuments;

    } catch (error) {
      console.error("Loop Fetch Error:", error);
      throw error;
    }
  };

   useEffect(() => {
    const initFetch = async () => {
      if (!user) { setIsLoading(false); return; }
      
      setIsLoading(true);
      try {
        const currentUserId = user.$id || user.userId;
        
        // 1. Fetch Online Data
        let onlineSales = [];
        try {
            onlineSales = await fetchAllDocuments(currentUserId);
        } catch (e) {
            console.warn("Could not fetch online data (offline?)");
        }

        // 2. Parse Online Data (Existing logic)
        const parsedOnline = onlineSales.map((sale) => {
             // ... your existing parsing logic ...
             let itemsArr = [];
             try { itemsArr = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items; } catch(e){}
             return { ...sale, items: itemsArr, totalAmount: Number(sale.totalAmount) || 0, saleDate: sale.saleDate || sale.$createdAt };
        });

        // 3. MERGE WITH OFFLINE DATA (NEW CODE)
        // This gets sales from LocalStorage and combines them
        const allSales = getCombinedData(parsedOnline, 'sales');

        // 4. Sort
        allSales.sort((a, b) => {
          const aTime = new Date(a.saleDate).getTime();
          const bTime = new Date(b.saleDate).getTime();
          return bTime - aTime;
        });

        setSales(allSales);

      } catch (err) {
        console.error("❌ Sales fetch error:", err);
        toast.error("Error loading sales history.");
        setSales([]);
      } finally {
        setIsLoading(false);
      }
    };

    initFetch();
  }, [user]);

  const groupedSales = useMemo(() => {
    const groups = {};
    
    sales.forEach((sale) => {
      const dateKey = getLocalDateKey(sale.saleDate);
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          totalRevenue: 0,
          totalSales: 0,
          transactions: []
        };
      }
      
      groups[dateKey].totalRevenue += Number(sale.totalAmount) || 0;
      groups[dateKey].totalSales += 1;
      groups[dateKey].transactions.push(sale);
    });

    return Object.values(groups).sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
      return b.date.localeCompare(a.date);
    });
  }, [sales]);

  const totalRevenue = useMemo(() => {
    return sales.reduce((acc, sale) => acc + (Number(sale.totalAmount) || 0), 0);
  }, [sales]);

  const toggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-900">
        <FiLoader className="animate-spin text-4xl text-indigo-500 mb-4" />
        <span className="text-slate-400 font-medium">Loading History...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 pb-24 font-sans">
      
      <div className="max-w-4xl mx-auto mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Sales History
        </h1>
        <p className="text-slate-400">Track your daily transactions and revenue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
             <FiFileText className="text-3xl text-indigo-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Bills</p>
            <p className="text-3xl text-white mt-1 font-bold">{sales.length}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-emerald-500/20 p-6 rounded-2xl flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <FaRupeeSign className="text-3xl text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Revenue</p>
            <p className="text-3xl text-white mt-1 font-bold">₹{totalRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {groupedSales.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-700/50 border-dashed">
            <FiFileText className="text-5xl text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 text-xl font-medium">No sales history found.</p>
            <p className="text-slate-500 text-sm mt-2">
              Transactions will appear here once you start billing.
            </p>
          </div>
        ) : (
          groupedSales.map((day) => (
            <div key={day.date} className="bg-slate-800/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-md transition-all hover:border-indigo-500/30">
              <div
                className="flex flex-col sm:flex-row justify-between items-center p-4 cursor-pointer hover:bg-slate-700/30 transition-colors gap-4 sm:gap-0"
                onClick={() => toggleExpand(day.date)}
              >
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="bg-slate-700 p-3 rounded-xl">
                    <FiCalendar className="text-xl text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-white">
                      {(() => {
                        const d = new Date(day.date);
                        if (Number.isNaN(d.getTime())) return day.date;
                        return d.toLocaleDateString("en-IN", {
                          weekday: "short", day: "2-digit", month: "short", year: "numeric"
                        });
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">{day.totalSales} Bills</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between w-full sm:w-auto gap-6 pl-14 sm:pl-0">
                  <p className="font-bold text-xl text-emerald-400">₹{(Number(day.totalRevenue) || 0).toLocaleString('en-IN')}</p>
                  <div className={`transform transition-transform duration-300 ${expandedDate === day.date ? 'rotate-180' : ''}`}>
                      <FiChevronDown className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedDate === day.date && (
                <div className="border-t border-slate-700/50 bg-slate-900/50 p-2 md:p-4 space-y-2 animate-fade-in">
                  {day.transactions.map((sale) => (
                    <div key={sale.$id || Math.random()} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex p-2 bg-slate-700 rounded-lg">
                            <FiClock className="text-indigo-300" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold text-slate-200">
                            {(() => {
                                const ts = sale.saleDate || sale.$createdAt || null;
                                const d = ts ? new Date(ts) : null;
                                return (d && !Number.isNaN(d.getTime())) ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "-";
                            })()}
                            </span>
                            <span className="text-xs text-slate-500">
                            {Array.isArray(sale.items) ? sale.items.length : 0} items
                            </span>
                        </div>
                      </div>
                      
                      {/* --- NEW: Payment Mode Badge --- */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-emerald-400 text-lg">
                            ₹{(Number(sale.totalAmount) || 0).toLocaleString('en-IN')}
                        </span>

                        {sale.isOffline && (
        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/50">
            Offline (Pending Sync)
        </span>
    )}

                        
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            (sale.paymentMode || 'cash') === 'online'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                            {(sale.paymentMode || 'cash') === 'online' ? <FiCreditCard size={10} /> : <FiDollarSign size={10} />}
                            {sale.paymentMode || 'cash'}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesHistory;
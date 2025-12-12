import React, { useState, useEffect, useMemo } from 'react';
import { FiCalendar, FiFileText, FiChevronDown, FiChevronUp, FiClock, FiLoader } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { databases, AppwriteConfig, Query } from '../appwrite/config';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

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

  useEffect(() => {
    const fetchSales = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const currentUserId = user.$id || user.userId;
      if (!currentUserId) {
        console.error("No user ID found");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      console.log("Fetching sales for user:", currentUserId);
      console.log("Config:", { db: AppwriteConfig.databaseId, coll: AppwriteConfig.salesCollectionId });

      try {
        // Fetch with Query.limit to avoid issues with empty array
        const response = await databases.listDocuments(
          AppwriteConfig.databaseId,
          AppwriteConfig.salesCollectionId,
          [Query.limit(1000)]
        );

        console.log("✅ Documents fetched:", response.documents.length);

        // Client-side filter
        const mySales = response.documents.filter(doc => {
          const docUser = doc.userId || doc.userid || doc.user_id;
          return docUser === currentUserId;
        });

        console.log("📊 Filtered for current user:", mySales.length);

        // Parse and format
        const parsed = mySales.map((sale) => {
          let itemsArr = [];
          try {
            if (Array.isArray(sale.items)) {
              itemsArr = sale.items;
            } else if (typeof sale.items === 'string') {
              itemsArr = JSON.parse(sale.items);
            }
          } catch (e) {
            itemsArr = [];
          }

          const saleDate = sale.saleDate || sale.$createdAt || new Date().toISOString();
          const totalAmount = Number(sale.totalAmount || 0);

          return {
            ...sale,
            items: itemsArr,
            totalAmount,
            saleDate
          };
        });

        // Sort by date (newest first)
        parsed.sort((a, b) => {
          const aTime = new Date(a.saleDate).getTime();
          const bTime = new Date(b.saleDate).getTime();
          return bTime - aTime;
        });

        setSales(parsed);
        console.log("📈 Sorted sales ready:", parsed.length);

      } catch (err) {
        console.error("❌ Sales fetch error:", err);
        console.error("Error details:", { code: err.code, message: err.message });
        toast.error("Error loading sales: " + (err.message || "Unknown error"));
        setSales([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
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

    // Sort by date (newer first)
    return Object.values(groups).sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
        return bTime - aTime;
      }
      if (!Number.isNaN(aTime)) return -1;
      if (!Number.isNaN(bTime)) return 1;
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
      <div className="flex justify-center items-center h-screen bg-transparent">
        <FiLoader className="animate-spin text-4xl text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 text-white min-h-screen">
      <h1 className="text-3xl text-center font-bold mb-8 bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
        My Sales History
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
        <div className="bg-black/30 backdrop-blur-2xl border border-yellow-500/30 p-6 rounded-2xl flex items-center gap-4">
          <FiFileText className="text-4xl text-yellow-400" />
          <div>
            <p className="text-yellow-300 text-sm">My Bills</p>
            <p className="text-2xl text-white mt-1 font-bold">{sales.length}</p>
          </div>
        </div>

        <div className="bg-black/30 backdrop-blur-2xl border border-pink-500/30 p-6 rounded-2xl flex items-center gap-4">
          <FaRupeeSign className="text-4xl text-pink-500" />
          <div>
            <p className="text-pink-300 text-sm">My Revenue</p>
            <p className="text-2xl text-white mt-1 font-bold">₹{totalRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {groupedSales.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-yellow-400 text-lg">No sales history found.</p>
            <p className="text-gray-500 text-sm mt-2">
              Create a bill to get started.
            </p>
          </div>
        ) : (
          groupedSales.map((day) => (
            <div key={day.date} className="bg-black/30 backdrop-blur-xl border border-purple-500/20 rounded-2xl overflow-hidden">
              <div
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-white/5"
                onClick={() => toggleExpand(day.date)}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-purple-500/20 p-3 rounded-xl">
                    <FiCalendar className="text-xl text-purple-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-white">
                      {(() => {
                        const d = new Date(day.date);
                        if (Number.isNaN(d.getTime())) return day.date;
                        try {
                          return d.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          });
                        } catch (e) {
                          return day.date;
                        }
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-lg text-pink-400">₹{(Number(day.totalRevenue) || 0).toLocaleString('en-IN')}</p>
                  {expandedDate === day.date ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>

              {expandedDate === day.date && (
                <div className="border-t border-white/10 bg-black/20 p-4 space-y-3">
                  {day.transactions.map((sale) => (
                    <div key={sale.$id || Math.random()} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        <FiClock className="text-purple-400/70" />
                        <span className="text-sm text-gray-300">
                          {(() => {
                            const ts = sale.saleDate || sale.$createdAt || null;
                            const d = ts ? new Date(ts) : null;
                            if (!d || Number.isNaN(d.getTime())) return "-";
                            try {
                              return d.toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true
                              });
                            } catch (e) {
                              return "-";
                            }
                          })()}
                        </span>
                      </div>
                      <span className="text-sm text-yellow-300">
                        {Array.isArray(sale.items) ? sale.items.length : 0} items
                      </span>
                      <span className="font-semibold text-pink-400">
                        ₹{(Number(sale.totalAmount) || 0).toLocaleString('en-IN')}
                      </span>
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

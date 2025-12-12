import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import { toast } from "react-toastify";
import { FaRupeeSign } from "react-icons/fa";
import { FiTrendingUp, FiInfo, FiLoader } from "react-icons/fi";

import { usePurchases } from '../context/PurchaseContext';
import { useAuth } from '../context/AuthContext';
import { databases, AppwriteConfig, Query } from '../appwrite/config';

// --- NEW IMPORT FOR OFFLINE LOGIC ---
import { getCombinedData } from "../utils/OfflineManager";

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend
);

const Analysis = () => {
  const { user } = useAuth();
  const { purchases, isLoading: purchasesLoading } = usePurchases();
  
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("7d");

  // Fetch sales data (Online + Offline)
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user) return;
      const userId = user.$id || user.userId;

      setIsLoading(true);
      try {
        let onlineSales = [];

        // 1. Try fetching Online Data if connected
        if (navigator.onLine) {
            try {
                const response = await databases.listDocuments(
                  AppwriteConfig.databaseId,
                  AppwriteConfig.salesCollectionId,
                  [Query.equal('userId', userId)]
                );
                onlineSales = response.documents;
            } catch (err) {
                console.warn("Could not fetch online sales, switching to offline view.");
            }
        }

        // 2. Parse Online Data
        const parsedOnline = onlineSales.map(sale => {
            let itemsArr = [];
            try { 
                // Handle case where items is string (DB) or already object
                itemsArr = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items; 
            } catch(e) {}
            return { 
                ...sale, 
                items: itemsArr, 
                totalAmount: Number(sale.totalAmount) || 0,
                saleDate: sale.saleDate || sale.$createdAt 
            };
        });

        // 3. Merge with Offline Data
        const allSales = getCombinedData(parsedOnline, 'sales');
        
        // 4. Sort by Date (Desc)
        allSales.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

        setSales(allSales);

      } catch (error) {
        toast.error("Error loading analysis data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [user]);

  // Calculations
  const analysisData = useMemo(() => {
    if (sales.length === 0 && purchases.length === 0) return null;

    // 1. Calculate Revenue (from merged Sales)
    const totalRevenue = sales.reduce((acc, sale) => acc + (Number(sale.totalAmount) || 0), 0);

    // 2. Calculate Cost (Merge Context Purchases + Offline Purchases)
    // We use getCombinedData here to ensure freshly added offline stocks are counted
    const allPurchases = getCombinedData(purchases, 'purchases');
    const totalCost = allPurchases.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);

    // 3. Calculate Profits
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // 4. Averages
    const totalSales = sales.length;
    const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // 5. Prepare Charts Data
    const salesByDate = sales.reduce((acc, sale) => {
      const dateKey = new Date(sale.saleDate).toISOString().split("T")[0];
      acc[dateKey] = (acc[dateKey] || 0) + (Number(sale.totalAmount) || 0);
      return acc;
    }, {});

    const productPerformance = sales
      .flatMap((s) => s.items || [])
      .reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + (Number(item.totalPrice) || 0);
        return acc;
      }, {});
      
    const sortedProducts = Object.entries(productPerformance).sort((a, b) => b[1] - a[1]);
    
    // Top 4 + Others
    const TOP_N_PRODUCTS = 4;
    let finalTopProducts = [];
    if (sortedProducts.length > TOP_N_PRODUCTS + 1) {
      const topN = sortedProducts.slice(0, TOP_N_PRODUCTS);
      const othersRevenue = sortedProducts.slice(TOP_N_PRODUCTS).reduce((sum, p) => sum + p[1], 0);
      finalTopProducts = [...topN, ["Others", othersRevenue]];
    } else {
      finalTopProducts = sortedProducts;
    }

    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const salesByDayOfWeek = Array(7).fill(0);
    sales.forEach((sale) => {
      const d = new Date(sale.saleDate);
      if(!isNaN(d)) {
          const dayIndex = d.getDay(); 
          const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; 
          salesByDayOfWeek[adjustedIndex] += (Number(sale.totalAmount) || 0);
      }
    });

    return {
      kpis: { totalRevenue, totalSales, avgSaleValue, totalCost, netProfit, profitMargin },
      salesByDate,
      allProducts: sortedProducts,
      finalTopProducts,
      salesByDay: { labels: daysOfWeek, data: salesByDayOfWeek },
    };
  }, [sales, purchases]);
  
  // --- CHART DESIGNS ---

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#e5e5e5", boxWidth: 12, padding: 20 } },
      tooltip: {
        backgroundColor: "#1c1917",
        titleColor: "#facc15",
        bodyColor: "#e5e5e5",
        padding: 10,
        borderColor: "#a855f7",
        borderWidth: 1,
        callbacks: {
          label: (context) => `Revenue: ₹${context.parsed.y || context.parsed}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: "#a3a3a3" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#a3a3a3" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  // 1. Line Chart Data
  const lineChartData = useMemo(() => {
    const daysToShow = timeframe === "7d" ? 7 : 30;
    const labels = Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }).reverse();
    
    const dataPoints = labels.map((label) => {
      const [day, month] = label.split(" ");
      const year = new Date().getFullYear();
      const dateKey = new Date(`${month} ${day}, ${year}`).toISOString().split("T")[0];
      return analysisData?.salesByDate[dateKey] || 0;
    });

    return {
      labels,
      datasets: [
        {
          label: "Daily Revenue",
          data: dataPoints,
          fill: true,
          borderColor: (c) => {
            const { ctx, chartArea: ca } = c.chart;
            if (!ca) return "#a855f7";
            const g = ctx.createLinearGradient(ca.left, 0, ca.right, 0);
            g.addColorStop(0, "#a855f7");
            g.addColorStop(1, "#ec4899");
            return g;
          },
          backgroundColor: (c) => {
            const { ctx, chartArea: ca } = c.chart;
            if (!ca) return "rgba(168,85,247,0.4)";
            const g = ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
            g.addColorStop(0, "rgba(168,85,247,0.4)");
            g.addColorStop(1, "rgba(236,72,153,0.0)");
            return g;
          },
          tension: 0.4,
          pointBackgroundColor: "#ec4899",
          pointBorderColor: "#fff",
          pointRadius: 4,
          pointHoverRadius: 6
        },
      ],
    };
  }, [analysisData, timeframe]);

  // 2. Doughnut Chart
  const doughnutChartData = {
    labels: analysisData?.finalTopProducts.map((p) => p[0]) || [],
    datasets: [
      {
        data: analysisData?.finalTopProducts.map((p) => p[1]) || [],
        backgroundColor: ["#d946ef", "#a855f7", "#facc15", "#ec4899", "#f97316", "#a3a3a3"],
        borderColor: "#1c1917",
        borderWidth: 4,
        hoverOffset: 10,
      },
    ],
  };

  // 3. Bar Chart
  const barChartData = {
    labels: analysisData?.salesByDay.labels || [],
    datasets: [
      {
        label: "Revenue",
        data: analysisData?.salesByDay.data || [],
        backgroundColor: (c) => {
          const { ctx, chartArea: ca } = c.chart;
          if (!ca) return "#ec4899";
          const g = ctx.createLinearGradient(0, ca.bottom, 0, ca.top);
          g.addColorStop(0, "#ec4899");
          g.addColorStop(1, "rgba(236, 72, 153, 0.4)");
          return g;
        },
        borderColor: "#ec4899",
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 0.6,
      },
    ],
  };

  // 4. Custom Plugin for Center Text
  const doughnutCenterText = {
    id: "doughnutCenterText",
    beforeDraw(chart) {
      const { ctx, data } = chart;
      if (data.datasets[0].data.length === 0) return;
      
      const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
      ctx.save();
      const x = chart.getDatasetMeta(0).data[0].x;
      const y = chart.getDatasetMeta(0).data[0].y;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px Poppins, sans-serif";
      ctx.fillStyle = "#facc15";
      ctx.fillText(`₹${total.toFixed(0)}`, x, y - 10);
      ctx.font = "12px Poppins, sans-serif";
      ctx.fillStyle = "#a3a3a3";
      ctx.fillText("Total Sales", x, y + 15);
      ctx.restore();
    },
  };

   if (isLoading || purchasesLoading) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <FiLoader className="animate-spin text-yellow-400 text-4xl" />
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">No Data Available</h1>
        <p className="mt-2 text-yellow-400">Please make some sales to see the analysis.</p>
        {!navigator.onLine && <p className="text-sm text-gray-500 mt-2">(You are Offline)</p>}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 text-white">
      <h1 className="text-3xl text-center font-bold mb-8 bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
        Business Analysis
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        {/* Total Revenue */}
        <div className="bg-black/30 backdrop-blur-2xl border border-pink-500/30 p-6 rounded-2xl relative group cursor-help transition-transform hover:-translate-y-1 hover:shadow-pink-500/20 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-pink-500/20 rounded-full">
                <FaRupeeSign className="text-2xl text-pink-400" />
            </div>
            <div>
              <p className="text-pink-300 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold mt-1">₹{analysisData.kpis.totalRevenue.toFixed(0)}</p>
            </div>
          </div>
          <div className="absolute top-full left-0 mt-2 hidden group-hover:block w-full bg-stone-900 border border-white/10 p-2 text-xs text-gray-300 rounded shadow-xl z-10 text-center">
             (Kul Kamayi) Including offline bills.
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-black/30 backdrop-blur-2xl border border-yellow-500/30 p-6 rounded-2xl relative group cursor-help transition-transform hover:-translate-y-1 hover:shadow-yellow-500/20 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-full">
                <FaRupeeSign className="text-2xl text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-300 text-xs font-bold uppercase tracking-wider">Total Cost</p>
              <p className="text-2xl font-bold mt-1">₹{analysisData.kpis.totalCost.toFixed(0)}</p>
            </div>
          </div>
           <div className="absolute top-full left-0 mt-2 hidden group-hover:block w-full bg-stone-900 border border-white/10 p-2 text-xs text-gray-300 rounded shadow-xl z-10 text-center">
             (Kul Kharcha) Jitna maal khareedne me laga.
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-black/30 backdrop-blur-2xl border border-green-500/30 p-6 rounded-2xl relative group cursor-help transition-transform hover:-translate-y-1 hover:shadow-green-500/20 shadow-lg">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${analysisData.kpis.netProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <FiTrendingUp className={`text-2xl ${analysisData.kpis.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className={`${analysisData.kpis.netProfit >= 0 ? 'text-green-300' : 'text-red-300'} text-xs font-bold uppercase tracking-wider`}>Net Profit</p>
              <p className={`text-2xl font-bold mt-1 ${analysisData.kpis.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>₹{analysisData.kpis.netProfit.toFixed(0)}</p>
            </div>
          </div>
           <div className="absolute top-full left-0 mt-2 hidden group-hover:block w-full bg-stone-900 border border-white/10 p-2 text-xs text-gray-300 rounded shadow-xl z-10 text-center">
             (Asli Munafa) Kharcha nikalne ke baad bacha paisa.
          </div>
        </div>

        {/* Avg Sale */}
        <div className="bg-black/30 backdrop-blur-2xl border border-purple-500/30 p-6 rounded-2xl relative group cursor-help transition-transform hover:-translate-y-1 hover:shadow-purple-500/20 shadow-lg">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-purple-500/20 rounded-full">
                <FiInfo className="text-2xl text-purple-400" />
            </div>
            <div>
              <p className="text-purple-300 text-xs font-bold uppercase tracking-wider">Avg. Bill Value</p>
              <div className="text-2xl font-bold mt-1 text-pink-400">
                  ₹{analysisData.kpis.avgSaleValue.toFixed(0)}
              </div>
            </div>
          </div>
           <div className="absolute top-full left-0 mt-2 hidden group-hover:block w-full bg-stone-900 border border-white/10 p-2 text-xs text-gray-300 rounded shadow-xl z-10 text-center">
             Average ek customer kitne ka bill banata hai.
          </div>
        </div>

      </div>

      {/* Main Line Chart */}
      <div className="bg-black/30 backdrop-blur-2xl border border-purple-500/20 p-6 rounded-2xl shadow-lg mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-yellow-400">
            Revenue Trends
          </h2>
          <div className="flex gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
            <button onClick={() => setTimeframe("7d")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${timeframe === "7d" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>7 Days</button>
            <button onClick={() => setTimeframe("30d")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${timeframe === "30d" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>30 Days</button>
          </div>
        </div>
        <div className="h-80">
          <Line options={chartOptions} data={lineChartData} />
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doughnut Chart */}
        <div className="bg-black/30 backdrop-blur-2xl border border-purple-500/20 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-yellow-400 mb-6">Top Selling Products</h2>
          <div className="h-64 relative flex justify-center">
            <Doughnut
              options={{...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: "right" } }}}
              data={doughnutChartData}
              plugins={[doughnutCenterText]} // PLUGIN IS BACK
            />
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-black/30 backdrop-blur-2xl border border-purple-500/20 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-yellow-400 mb-6">Weekly Performance</h2>
          <div className="h-64">
            <Bar options={chartOptions} data={barChartData} />
          </div>
        </div>
      </div>

      {/* Product Ranking List */}
      <div className="bg-black/30 mt-10 backdrop-blur-2xl border border-purple-500/20 p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold text-yellow-400 mb-6">
          Product Sales Ranking
        </h2>
        <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          <ul className="space-y-3">
            {analysisData.allProducts.map(([name, revenue], index) => (
              <li
                key={name}
                className="flex justify-between items-center text-sm bg-gradient-to-r from-white/5 to-transparent p-4 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index < 3 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-300'}`}>
                        {index + 1}
                    </span>
                    <span className="text-gray-200 font-medium">{name}</span>
                </div>
                <span className="font-bold text-pink-400">
                  ₹{revenue.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
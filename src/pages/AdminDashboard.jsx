import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { databases, AppwriteConfig, Query, client } from "../appwrite/config";
import { useAuth } from "../context/AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FaSpinner,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimes,
  FaSyncAlt,
  FaClock,
  FaMapMarkerAlt,
  FaCrown,
  FaUserPlus,
  FaFileCsv,
  FaWallet,
  FaMoneyBillWave,
  FaKey,
  FaTags,
  FaPhoneAlt,
  FaCogs,
  FaEdit,
  FaHistory,
  FaWhatsapp,   // NEW
  FaBullhorn,   // NEW
  FaLink,       // NEW
  FaImage       // NEW
} from "react-icons/fa";

// --- DEFAULT PLANS ---
const DEFAULT_PLANS = [
  {
    name: "Starter Plan",
    duration: 7,
    extra: 2,
    price: 120,
    maintenance: 49,
    color: "pink",
  },
  {
    name: "Growth Plan",
    duration: 15,
    extra: 5,
    price: 320,
    maintenance: 99,
    color: "purple",
  },
  {
    name: "Pro Plan",
    duration: 30,
    extra: 7,
    price: 699,
    maintenance: 199,
    color: "yellow",
    popular: true,
  },
];

const safeParse = (str) => {
  try {
    return typeof str === "string" ? JSON.parse(str) : str;
  } catch (e) {
    return null;
  }
};

const StatusBadge = ({ status }) => {
  if (status === "pending")
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded-full border border-yellow-700/50">
        <FaHourglassHalf className="animate-spin" /> Pending
      </div>
    );
  if (status === "approved")
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-green-300 bg-green-900/20 px-2 py-1 rounded-full border border-green-700/50">
        <FaCheckCircle /> Active
      </div>
    );
  if (status === "cancelled")
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 bg-gray-800 px-2 py-1 rounded-full border border-gray-600">
        <FaTimes /> Cancelled
      </div>
    );
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-300 bg-red-900/20 px-2 py-1 rounded-full border border-red-700/50">
      <FaTimes /> Inactive
    </div>
  );
};

const ExpiryCountdown = ({ expiryDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!expiryDate) {
      setTimeLeft("N/A");
      return;
    }
    const target = new Date(expiryDate).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      let formattedTime = "";
      if (days > 0) formattedTime += `${days}d `;
      if (hours > 0) formattedTime += `${hours}h `;
      if (days === 0 && hours === 0) formattedTime += "Expiring soon";
      setTimeLeft(formattedTime.trim());
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [expiryDate]);
  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-300">
        <FaClock
          className={
            timeLeft === "Expired" ? "text-red-400" : "text-yellow-400"
          }
        />{" "}
        {timeLeft}
      </span>
      {expiryDate && (
        <span className="text-[10px] text-gray-500 mt-0.5">
          {new Date(expiryDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [totalShopEarnings, setTotalShopEarnings] = useState(0);
  const [settingsDocId, setSettingsDocId] = useState(null);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  
  // Modals State
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [offerModal, setOfferModal] = useState({ show: false, customer: null });
  const [discountInput, setDiscountInput] = useState(0);
  const [earningsModal, setEarningsModal] = useState({
    show: false,
    customer: null,
    groups: [],
    loading: false,
    total: 0,
  });

  // --- NEW: WhatsApp Marketing State ---
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [marketingType, setMarketingType] = useState('message'); // message, url, feature, poster
  const [marketingData, setMarketingData] = useState({
      message: "",
      url: "",
      featureTitle: "",
      featureDesc: "",
      posterUrl: ""
  });
  // -------------------------------------

  const isInitialLoadDone = useRef(false);

  // --- FETCH DATA ---
  const fetchUsersAndSales = useCallback(async (isBackground = false) => {
    if (!isBackground && !isInitialLoadDone.current) setLoading(true);

    try {
      const [profileResponse, settingsResponse, salesResponse] =
        await Promise.all([
          databases.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.userCollectionId,
            [Query.limit(5000), Query.orderDesc("$createdAt")]
          ),
          databases.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.settingsCollectionId,
            [Query.limit(5000)]
          ),
          databases.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.salesCollectionId,
            [Query.limit(5000)]
          ),
        ]);

      // 1. Settings
      const settingsMap = {};
      let foundPlansDocId = null;
      let firstDocId = null;

      settingsResponse.documents.forEach((doc) => {
        if (doc.userId) settingsMap[doc.userId] = doc;
        if (!firstDocId) firstDocId = doc.$id;
        if (doc.plansData && doc.plansData.length > 10) {
          foundPlansDocId = doc.$id;
          const parsed = safeParse(doc.plansData);
          if (parsed) setPlans(parsed);
        }
      });
      setSettingsDocId(foundPlansDocId || firstDocId);

      // 2. Earnings
      const earningsPerUser = salesResponse.documents.reduce((acc, sale) => {
        const userId = sale.userId || sale.userid || sale.user_id || sale.$id;
        const saleTotal = Number(sale.totalAmount) || 0;
        if (userId) {
          if (!acc[userId]) acc[userId] = 0;
          acc[userId] += saleTotal;
        }
        return acc;
      }, {});

      // 3. Map Data
      const mappedCustomers = profileResponse.documents.map((doc) => {
        let status = doc.paymentStatus;
        if (
          status === "approved" &&
          doc.planExpiry &&
          new Date(doc.planExpiry) < new Date()
        ) {
          status = "expired";
        }
        const userSettings = settingsMap[doc.userId] || settingsMap[doc.$id];
        const mobile =
          doc.mobile ||
          doc.phone ||
          userSettings?.mobile ||
          userSettings?.shopMobile ||
          "N/A";
        const address =
          doc.shopAddress || userSettings?.shopAddress || "No address found";
        const gst = userSettings?.shopGstNumber || "N/A";
        const isGstVisualEnabled = userSettings?.gstEnabled === true;
        const userEarnings =
          earningsPerUser[doc.userId] || earningsPerUser[doc.$id] || 0;

        return {
          id: doc.$id,
          userId: doc.userId,
          name: doc.name,
          email: doc.email,
          mobile: mobile,
          status: status,
          planExpiry: doc.planExpiry,
          pendingPlanDetails: safeParse(doc.pendingPlanDetails),
          isGstEnabled: isGstVisualEnabled,
          gstNumber: gst,
          shopAddress: address,
          activePlan: doc.activePlan || "None",
          totalPlansPurchased: doc.totalPlansPurchased || 0,
          totalRevenueGenerated: doc.totalRevenueGenerated || 0,
          userTotalEarnings: userEarnings,
          discountPercent: doc.discountPercent || 0,
        };
      });

      setCustomers(mappedCustomers);
      const totalEarnings = salesResponse.documents.reduce(
        (sum, sale) => sum + (Number(sale.totalAmount) || 0),
        0
      );
      setTotalShopEarnings(totalEarnings);
      isInitialLoadDone.current = true;
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndSales();
  }, [fetchUsersAndSales]);

  // --- STRONG REALTIME LISTENER ---
  useEffect(() => {
    const channelIds = [
      `databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.userCollectionId}.documents`,
      `databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.salesCollectionId}.documents`,
    ];

    console.log("Admin: Listening for updates...");

    const unsubscribe = client.subscribe(channelIds, (response) => {
      const { events, payload } = response;
      const collectionId = payload.$collectionId;

      // 1. Handle Sales Updates (Refresh Earnings)
      if (collectionId === AppwriteConfig.salesCollectionId) {
         fetchUsersAndSales(true);
         return;
      }

      // 2. Handle User Profile Updates (Approvals/Cancels)
      if (collectionId === AppwriteConfig.userCollectionId) {
        if (events.some(e => e.includes(".update"))) {
            console.log("Realtime: User Updated", payload.$id);
            
            // PAYLOAD-BASED UPDATE (Prevents stale data from re-fetch)
            setCustomers((prevCustomers) => 
                prevCustomers.map((c) => {
                    if (c.id === payload.$id) {
                        // Merge the existing computed fields (earnings, address) with new payload data
                        let newStatus = payload.paymentStatus;
                        // Re-check expiry logic locally
                        if (newStatus === "approved" && payload.planExpiry && new Date(payload.planExpiry) < new Date()) {
                            newStatus = "expired";
                        }
                        
                        return {
                            ...c, // Keep earnings, gst, address etc.
                            status: newStatus,
                            activePlan: payload.activePlan,
                            planExpiry: payload.planExpiry,
                            pendingPlanDetails: safeParse(payload.pendingPlanDetails),
                            totalPlansPurchased: payload.totalPlansPurchased,
                            totalRevenueGenerated: payload.totalRevenueGenerated,
                            discountPercent: payload.discountPercent,
                            name: payload.name,
                            email: payload.email,
                            mobile: payload.mobile || payload.phone || c.mobile // fallback
                        };
                    }
                    return c;
                })
            );
        } else {
            // For creates/deletes, safer to re-fetch
            fetchUsersAndSales(true);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [fetchUsersAndSales]);

  // --- HANDLERS ---
  const handleSavePlans = async () => {
    if (!settingsDocId) {
      toast.error("No Settings Document found.");
      return;
    }
    try {
      await databases.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.settingsCollectionId,
        settingsDocId,
        { plansData: JSON.stringify(plans) }
      );
      toast.success("Plans updated!");
      setShowPlansModal(false);
    } catch (error) {
      toast.error("Update failed.");
    }
  };

  const handlePlanChange = (index, field, value) => {
    const updatedPlans = [...plans];
    updatedPlans[index] = { ...updatedPlans[index], [field]: Number(value) };
    setPlans(updatedPlans);
  };

  const handleOpenOfferModal = (customer) => {
    setOfferModal({ show: true, customer });
    setDiscountInput(customer.discountPercent || 0);
  };

  const handleSaveOffer = async () => {
    if (!offerModal.customer) return;
    try {
      await databases.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.userCollectionId,
        offerModal.customer.id,
        { discountPercent: Number(discountInput) || 0 }
      );
      toast.success(`Offer Set!`);
      setOfferModal({ show: false, customer: null });
    } catch (error) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  // --- NEW: WhatsApp Marketing Handler ---
  const handleSendMarketing = () => {
    const validCustomers = customers.filter(c => c.mobile && c.mobile !== "N/A" && c.mobile.length >= 10);
    const count = validCustomers.length;

    if(count === 0) return toast.warn("No customers with valid mobile numbers found.");

    let messageToSend = "";

    if (marketingType === 'message') {
        if(!marketingData.message) return toast.error("Please enter a message.");
        messageToSend = marketingData.message;
    } 
    else if (marketingType === 'url') {
        if(!marketingData.url) return toast.error("Please enter a URL.");
        messageToSend = `Check out our website: ${marketingData.url}`;
    }
    else if (marketingType === 'feature') {
        if(!marketingData.featureTitle) return toast.error("Please enter feature title.");
        messageToSend = `🚀 NEW FEATURE: *${marketingData.featureTitle}*\n\n${marketingData.featureDesc}`;
    }
    else if (marketingType === 'poster') {
        // Since we can't upload to WhatsApp directly from here without backend API, we send the URL
        if(!marketingData.posterUrl) return toast.error("Please enter image URL.");
        messageToSend = `Check out our latest offer!\n${marketingData.posterUrl}\n\n${marketingData.message}`;
    }

    // SIMULATION OF API CALL
    console.log(`Sending to ${count} customers:`, messageToSend);
    console.log("Recipients:", validCustomers.map(c => c.mobile));

    // In a real scenario, you would call your backend API here
    // await axios.post('/api/send-bulk-whatsapp', { numbers: ..., message: ... })

    toast.success(`Broadcasting to ${count} customers initiated!`);
    setShowMarketingModal(false);
    
    // Reset Data
    setMarketingData({
        message: "",
        url: "",
        featureTitle: "",
        featureDesc: "",
        posterUrl: ""
    });
  };
  // ---------------------------------------

  const handleOpenEarningsModal = async (customer) => {
    if (!customer) return;
    const targetUserId = customer.userId;
    const targetDocId = customer.id || customer.$id;
    setEarningsModal({
      show: true,
      customer,
      groups: [],
      loading: true,
      total: 0,
    });
    try {
      const resp = await databases.listDocuments(
        AppwriteConfig.databaseId,
        AppwriteConfig.salesCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(5000)]
      );
      const docs = resp.documents.filter((doc) => {
        const saleUser = doc.userId || doc.userid || doc.user_id;
        return (
          saleUser && (saleUser === targetUserId || saleUser === targetDocId)
        );
      });
      const groupsMap = {};
      let grandTotal = 0;
      docs.forEach((s) => {
        const amt = Number(s.totalAmount || 0) || 0;
        const ts = s.saleDate || s.$createdAt || null;
        let dateKey = "Unknown Date";
        if (ts) {
          const d = new Date(ts);
          if (!Number.isNaN(d.getTime()))
            dateKey = d.toISOString().split("T")[0];
        }
        if (!groupsMap[dateKey])
          groupsMap[dateKey] = { date: dateKey, total: 0, transactions: [] };
        groupsMap[dateKey].total += amt;
        let itemsParsed = [];
        try {
          itemsParsed =
            typeof s.items === "string" ? JSON.parse(s.items) : s.items;
        } catch (e) {
          itemsParsed = [];
        }
        groupsMap[dateKey].transactions.push({
          ...s,
          totalAmount: amt,
          saleDate: ts,
          items: itemsParsed,
        });
        grandTotal += amt;
      });
      const groups = Object.values(groupsMap).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      setEarningsModal({
        show: true,
        customer,
        groups,
        loading: false,
        total: grandTotal,
      });
    } catch (err) {
      setEarningsModal({
        show: true,
        customer,
        groups: [],
        loading: false,
        total: 0,
      });
    }
  };

  const handleCloseEarningsModal = () =>
    setEarningsModal({
      show: false,
      customer: null,
      groups: [],
      loading: false,
      total: 0,
    });

  const handleApprove = async (customer) => {
    if (!customer.pendingPlanDetails) return toast.error("No pending details!");
    setApprovingId(customer.id);

    try {
      const userProfile = await databases.getDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.userCollectionId,
        customer.id
      );
      let startDate = new Date();
      if (
        userProfile.planExpiry &&
        new Date(userProfile.planExpiry) > startDate
      )
        startDate = new Date(userProfile.planExpiry);
      const plan = customer.pendingPlanDetails;
      const totalDuration = (plan.duration || 0) + (plan.extra || 0);
      const newExpiryDate = new Date(startDate);
      newExpiryDate.setDate(startDate.getDate() + totalDuration);

      const updatedData = {
        paymentStatus: "approved",
        activePlan: plan.planName,
        planExpiry: newExpiryDate.toISOString(),
        pendingPlanDetails: null, // Clear pending details
        totalPlansPurchased: (userProfile.totalPlansPurchased || 0) + 1,
        totalRevenueGenerated:
          (userProfile.totalRevenueGenerated || 0) + (plan.totalPrice || 0),
      };

      // Optimistic Update (Immediate Feedback)
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id
            ? {
                ...c,
                status: "approved",
                activePlan: plan.planName,
                planExpiry: newExpiryDate.toISOString(),
                pendingPlanDetails: null, // Critical for UI
                totalPlansPurchased: c.totalPlansPurchased + 1,
              }
            : c
        )
      );

      await databases.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.userCollectionId,
        customer.id,
        updatedData
      );

      toast.success(`Plan Approved!`);
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
      // Revert if failed
      fetchUsersAndSales(); 
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancel = async (customer) => {
    if (!window.confirm(`Cancel request?`)) return;
    setApprovingId(customer.id);
    
    // Optimistic Update
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id ? { ...c, pendingPlanDetails: null, status: "cancelled" } : c
      )
    );

    try {
      await databases.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.userCollectionId,
        customer.id,
        { 
            pendingPlanDetails: null,
            paymentStatus: "cancelled" 
        }
      );
      toast.warn("Cancelled.");
    } catch (err) {
      toast.error("Failed.");
      fetchUsersAndSales();
    } finally {
      setApprovingId(null);
    }
  };

  const totalPlanRevenue = useMemo(
    () => customers.reduce((sum, c) => sum + c.totalRevenueGenerated, 0),
    [customers]
  );
  
  // Revised Filter: Checks stricter condition
  const pendingCustomers = useMemo(
    () =>
      customers.filter((c) => c.status === "pending" || (c.pendingPlanDetails && c.pendingPlanDetails !== null && c.status !== "approved")),
    [customers]
  );

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Mobile",
      "Address",
      "Status",
      "Plan",
      "Times Bought",
      "Expires",
      "GST Active",
      "GSTIN",
      "Earnings",
      "Offer %",
    ];
    const rows = customers.map((c) =>
      [
        `"${c.name}"`,
        c.email,
        c.mobile,
        `"${c.shopAddress}"`,
        c.status,
        c.activePlan,
        c.totalPlansPurchased,
        c.planExpiry ? new Date(c.planExpiry).toLocaleDateString() : "N/A",
        c.isGstEnabled ? "Yes" : "No",
        c.gstNumber,
        c.userTotalEarnings.toFixed(2),
        c.discountPercent,
      ].join(",")
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `admin_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <ToastContainer theme="dark" position="bottom-right" autoClose={5000} />
      <main className="p-4 md:p-8 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Admin Dashboard
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            
            {/* NEW: WhatsApp CRM Button */}
            <button
              onClick={() => setShowMarketingModal(true)}
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-green-900/30 font-bold text-white animate-pulse"
            >
              <FaWhatsapp className="text-xl" /> WhatsApp CRM
            </button>

            <button
              onClick={() => setShowPlansModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <FaCogs /> Manage Plans
            </button>
            <button
              onClick={exportToCSV}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-indigo-900/20"
            >
              <FaFileCsv /> Export CSV
            </button>
            <button
              onClick={() => fetchUsersAndSales(false)}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-purple-900/20"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-gray-800/50 rounded-2xl border border-gray-700 flex items-center gap-4 hover:border-yellow-500/30 transition-all">
            <div className="p-4 bg-yellow-500/20 rounded-full">
              <FaWallet className="text-yellow-400 h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider font-bold">
                Total Plan Revenue
              </p>
              <p className="text-3xl font-bold text-white mt-1">
                ₹
                {totalPlanRevenue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          <div className="p-6 bg-gray-800/50 rounded-2xl border border-gray-700 flex items-center gap-4 hover:border-green-500/30 transition-all">
            <div className="p-4 bg-green-500/20 rounded-full">
              <FaMoneyBillWave className="text-green-400 h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider font-bold">
                Total Shop Earnings
              </p>
              <p className="text-3xl font-bold text-white mt-1">
                ₹
                {totalShopEarnings.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* PENDING */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-400">
            <FaClock /> Pending Approvals ({pendingCustomers.length})
          </h3>
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4 min-h-[100px]">
            {loading && pendingCustomers.length === 0 ? (
              <div className="flex justify-center items-center h-20 text-gray-400">
                <FaSpinner className="animate-spin mr-2" /> Loading...
              </div>
            ) : pendingCustomers.length === 0 ? (
              <div className="text-center text-gray-500 py-6">
                No pending requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col lg:flex-row items-center justify-between p-4 bg-gray-700/40 rounded-xl gap-4 border border-gray-600/50 hover:bg-gray-700/60 transition-all"
                  >
                    <div className="flex-grow w-full">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg text-white">{c.name}</p>
                        <span className="text-xs text-gray-400 bg-black/30 px-2 py-0.5 rounded-full">
                          {c.email}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        <p className="text-sm text-yellow-300 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
                          Request:{" "}
                          <span className="font-bold">
                            {c.pendingPlanDetails?.planName}
                          </span>{" "}
                          (₹{c.pendingPlanDetails?.totalPrice})
                        </p>
                        {c.pendingPlanDetails?.transactionId && (
                          <p className="text-xs text-cyan-300 font-mono flex items-center gap-1">
                            <FaKey /> Txn: {c.pendingPlanDetails.transactionId}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <FaPhoneAlt size={10} /> {c.mobile}
                        </p>
                      </div>
                    </div>
                    <div className="w-full lg:w-auto flex gap-3">
                      <button
                        onClick={() => handleCancel(c)}
                        disabled={approvingId === c.id}
                        className="flex-1 lg:flex-none px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold border border-red-500/50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleApprove(c)}
                        disabled={approvingId === c.id}
                        className="flex-1 lg:flex-none px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 transition-all"
                      >
                        {approvingId === c.id ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaCheckCircle />
                        )}{" "}
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ALL CUSTOMERS (UPDATED TABLE) */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
            <FaUserPlus /> All Customers ({customers.length})
          </h3>
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase bg-gray-900/50 text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-4">Customer Details</th>
                    <th className="px-6 py-4">Earnings & GST</th>
                    <th className="px-6 py-4">Subscription</th>
                    <th className="px-6 py-4 text-center">Offer</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="text-center py-10">
                        <FaSpinner className="animate-spin inline mr-2" />{" "}
                        Loading data...
                      </td>
                    </tr>
                  ) : customers.length > 0 ? (
                    customers.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-700/20 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-white text-base">
                            {c.name}
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            {c.email}
                          </div>
                          <div
                            className="flex items-center gap-2 text-xs text-gray-400"
                            title={c.shopAddress}
                          >
                            <FaMapMarkerAlt className="text-red-400" />{" "}
                            <span className="truncate max-w-[120px]">
                              {c.shopAddress}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            <FaPhoneAlt size={10} className="text-blue-400" />{" "}
                            {c.mobile}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleOpenEarningsModal(c)}
                            className="flex items-center gap-2 font-bold text-green-400 text-base mb-1 hover:underline cursor-pointer"
                          >
                            <FaMoneyBillWave /> ₹
                            {(Number(c.userTotalEarnings) || 0).toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </button>
                          {c.isGstEnabled ? (
                            <span className="text-[10px] font-mono bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">
                              GST: {c.gstNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-600">
                              No GST
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="mb-2">
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-yellow-300 font-bold mb-1">
                            <FaCrown /> {c.activePlan}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded-full w-fit mb-1">
                            <FaHistory /> Bought: {c.totalPlansPurchased} times
                          </div>
                          <div className="mt-1">
                            <ExpiryCountdown expiryDate={c.planExpiry} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {c.discountPercent > 0 ? (
                            <div className="inline-block bg-pink-500/20 border border-pink-500/50 text-pink-300 px-3 py-1 rounded-lg font-bold text-xs shadow-[0_0_10px_rgba(236,72,153,0.2)]">
                              {c.discountPercent}% OFF
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenOfferModal(c)}
                            className="bg-blue-600/90 hover:bg-blue-500 text-white p-2 rounded-lg transition-all shadow-lg shadow-blue-900/20 group relative"
                          >
                            <FaTags />{" "}
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                              Set Offer
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="text-center py-8 text-gray-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* --- MODAL: MARKETING (NEW) --- */}
        {showMarketingModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-gray-800 border border-green-600/50 p-6 rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FaWhatsapp className="text-green-500 text-3xl" /> WhatsApp Marketing
                    </h3>
                    <button onClick={() => setShowMarketingModal(false)} className="text-gray-400 hover:text-white">
                        <FaTimes size={24}/>
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-xl">
                    <button onClick={() => setMarketingType('message')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${marketingType === 'message' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <FaBullhorn /> Bulk Message
                    </button>
                    <button onClick={() => setMarketingType('url')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${marketingType === 'url' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <FaLink /> Website URL
                    </button>
                    <button onClick={() => setMarketingType('feature')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${marketingType === 'feature' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <FaCogs /> New Feature
                    </button>
                    <button onClick={() => setMarketingType('poster')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${marketingType === 'poster' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <FaImage /> Poster
                    </button>
                </div>

                {/* Content Area */}
                <div className="space-y-4 mb-6">
                    {marketingType === 'message' && (
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Message Content</label>
                            <textarea 
                                rows="5"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-green-500 outline-none"
                                placeholder="Type your broadcast message here..."
                                value={marketingData.message}
                                onChange={(e) => setMarketingData({...marketingData, message: e.target.value})}
                            ></textarea>
                        </div>
                    )}

                    {marketingType === 'url' && (
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Website URL</label>
                            <input 
                                type="url"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-green-500 outline-none"
                                placeholder="https://your-website.com"
                                value={marketingData.url}
                                onChange={(e) => setMarketingData({...marketingData, url: e.target.value})}
                            />
                        </div>
                    )}

                    {marketingType === 'feature' && (
                        <>
                            <div>
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Feature Title</label>
                                <input 
                                    type="text"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:border-green-500 outline-none font-bold"
                                    placeholder="e.g. Offline Mode Added!"
                                    value={marketingData.featureTitle}
                                    onChange={(e) => setMarketingData({...marketingData, featureTitle: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Feature Description</label>
                                <textarea 
                                    rows="4"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:border-green-500 outline-none"
                                    placeholder="Explain the new feature..."
                                    value={marketingData.featureDesc}
                                    onChange={(e) => setMarketingData({...marketingData, featureDesc: e.target.value})}
                                ></textarea>
                            </div>
                        </>
                    )}

                     {marketingType === 'poster' && (
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Image URL (Poster)</label>
                            <input 
                                type="url"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-green-500 outline-none"
                                placeholder="https://..."
                                value={marketingData.posterUrl}
                                onChange={(e) => setMarketingData({...marketingData, posterUrl: e.target.value})}
                            />
                            <div className="mt-3">
                                 <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Caption (Optional)</label>
                                <input 
                                    type="text"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:border-green-500 outline-none"
                                    placeholder="Caption for the image"
                                    value={marketingData.message}
                                    onChange={(e) => setMarketingData({...marketingData, message: e.target.value})}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowMarketingModal(false)} className="px-6 py-3 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600">
                        Cancel
                    </button>
                    <button onClick={handleSendMarketing} className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 shadow-lg shadow-green-900/30 flex items-center gap-2">
                        <FaWhatsapp /> Send to All
                    </button>
                </div>
             </div>
          </div>
        )}

        {/* MODAL: PLANS */}
        {showPlansModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-600 p-6 rounded-2xl w-full max-w-4xl shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaCogs /> Manage Subscription Plans
                </h3>
                <button
                  onClick={() => setShowPlansModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border border-${plan.color}-500/30 bg-gray-900/50`}
                  >
                    <h4
                      className={`text-lg font-bold text-${plan.color}-400 mb-4 border-b border-gray-700 pb-2`}
                    >
                      {plan.name}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">
                          Base Price (₹)
                        </label>
                        <input
                          type="number"
                          value={plan.price}
                          onChange={(e) =>
                            handlePlanChange(index, "price", e.target.value)
                          }
                          className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">
                          Maintenance (₹)
                        </label>
                        <input
                          type="number"
                          value={plan.maintenance}
                          onChange={(e) =>
                            handlePlanChange(
                              index,
                              "maintenance",
                              e.target.value
                            )
                          }
                          className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">
                          Duration (Days)
                        </label>
                        <input
                          type="number"
                          value={plan.duration}
                          onChange={(e) =>
                            handlePlanChange(index, "duration", e.target.value)
                          }
                          className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">
                          Extra Days
                        </label>
                        <input
                          type="number"
                          value={plan.extra}
                          onChange={(e) =>
                            handlePlanChange(index, "extra", e.target.value)
                          }
                          className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button
                  onClick={() => setShowPlansModal(false)}
                  className="px-6 py-2 rounded-lg bg-gray-700 text-white font-bold hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePlans}
                  className="px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 flex items-center gap-2"
                >
                  <FaEdit /> Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* MODAL: OFFER */}
        {offerModal.show && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-600 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in-up">
              <h3 className="text-xl font-bold text-white mb-2">
                Exclusive Offer
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Set discount for{" "}
                <span className="text-yellow-400 font-bold">
                  {offerModal.customer?.name}
                </span>
              </p>
              <div className="mb-6 relative">
                <label className="block text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">
                  Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-xl p-4 text-white text-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-center"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setOfferModal({ show: false, customer: null })}
                  className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOffer}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500"
                >
                  Save Offer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EARNINGS */}
        {earningsModal.show && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-600 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in-up">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    💰 Earnings for {earningsModal.customer?.name || "User"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Total:{" "}
                    <span className="text-green-400 font-bold">
                      ₹{(Number(earningsModal.total) || 0).toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleCloseEarningsModal}
                  className="text-sm text-gray-300 hover:text-white font-bold"
                >
                  ✕ Close
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {earningsModal.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <FaSpinner className="animate-spin mr-2 text-yellow-400" />{" "}
                    Loading earnings...
                  </div>
                ) : earningsModal.groups && earningsModal.groups.length > 0 ? (
                  earningsModal.groups.map((g) => (
                    <div
                      key={g.date}
                      className="p-3 bg-black/20 rounded-lg border border-gray-700 hover:border-gray-600 transition-all"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold text-yellow-300">
                          📅{" "}
                          {(() => {
                            const d = new Date(g.date);
                            return Number.isNaN(d.getTime())
                              ? g.date
                              : d.toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                });
                          })()}
                        </div>
                        <div className="font-bold text-green-400">
                          ₹{(Number(g.total) || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    ⚠️ Error loading earnings
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
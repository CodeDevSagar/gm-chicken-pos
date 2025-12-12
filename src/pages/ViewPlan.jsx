import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { databases, AppwriteConfig, Query, client } from "../appwrite/config";
import { useCountdown } from "../hooks/useCountdown";
import {
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiGift,
  FiInfo,
  FiLoader,
  FiPercent,
} from "react-icons/fi";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

const CountdownTimer = ({ targetDate }) => {
  const [days, hours, minutes, seconds] = useCountdown(targetDate);
  if (days + hours + minutes + seconds <= 0) {
    return (
      <div className="text-red-400 font-bold text-lg text-center sm:text-right">
        Plan has expired!
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 sm:gap-3 text-center">
      {["Days", "Hours", "Minutes", "Seconds"].map((label, index) => (
        <div key={label} className="p-2 bg-black/20 rounded-lg w-14 sm:w-16">
          <span className="font-bold text-xl sm:text-2xl text-yellow-300">
            {[days, hours, minutes, seconds][index]}
          </span>
          <span className="block text-[10px] sm:text-xs text-gray-400">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
};

const ViewPlan = () => {
  const {
    user,
    requestPlanActivation,
    isLoading: isAuthLoading,
  } = useAuth();
  
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [userData, setUserData] = useState(user);
  
  // Use a ref to store current User ID to use inside the callback without re-binding
  const userIdRef = useRef(user?.$id);

  useEffect(() => {
    if (user) {
        setUserData(user);
        userIdRef.current = user.$id;
    }
  }, [user]);

  // --- FETCH PLANS ---
  const fetchPlans = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        AppwriteConfig.databaseId,
        AppwriteConfig.settingsCollectionId,
        [Query.limit(100)]
      );
      const globalConfigDoc = response.documents.find(
        (doc) => doc.plansData && doc.plansData.length > 10
      );
      if (globalConfigDoc && globalConfigDoc.plansData) {
        setPlans(JSON.parse(globalConfigDoc.plansData));
      }
    } catch (error) {
      console.error("Plan Fetch Error", error);
    } finally {
      setIsPlansLoading(false);
    }
  }, []);

  // --- REFRESH USER DATA (NETWORK REQUEST) ---
  const refreshUserData = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
        console.log("Fetching fresh user data...");
        const freshUser = await databases.getDocument(
            AppwriteConfig.databaseId,
            AppwriteConfig.userCollectionId,
            userIdRef.current
        );
        setUserData(freshUser);
    } catch (error) {
        console.error("Failed to refresh user data", error);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // --- REALTIME LISTENER ---
  useEffect(() => {
    const channelIds = [
      `databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.settingsCollectionId}.documents`,
      `databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.userCollectionId}.documents`,
    ];

    console.log("ViewPlan: Listening for updates...");
    
    const unsubscribe = client.subscribe(channelIds, (response) => {
      const collectionId = response.payload?.$collectionId;
      
      // 1. Update Plans
      if (collectionId === AppwriteConfig.settingsCollectionId) {
        fetchPlans();
      }

      // 2. Update User (Approvals / Cancellations / Discounts)
      if (collectionId === AppwriteConfig.userCollectionId) {
        // If the modified doc is THIS user, fetch fresh data
        if (userIdRef.current && response.payload.$id === userIdRef.current) {
          console.log("Realtime: My User Data Changed! Fetching...");
          refreshUserData();
        }
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [fetchPlans, refreshUserData]); 

  const discountPercent = useMemo(() => userData?.discountPercent || 0, [userData]);
  const isLoading = isAuthLoading || isPlansLoading;

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-screen">
        <FiLoader className="animate-spin text-4xl text-yellow-400" />
      </div>
    );

  const expiryDate = userData?.planExpiry ? new Date(userData.planExpiry) : null;
  const isSubscriptionActive =
    userData?.paymentStatus === "approved" && expiryDate && expiryDate > new Date();

  const handleRequestPlan = async (plan, finalPrice) => {
    if (!userData) {
      toast.error("Please login first to purchase a plan.");
      return;
    }
    try {
      await requestPlanActivation(plan, finalPrice);
      // Optimistic update for UI responsiveness
      setUserData(prev => ({ 
        ...prev, 
        paymentStatus: 'pending', 
        pendingPlanDetails: JSON.stringify({ 
          planName: plan.name, 
          totalPrice: finalPrice 
        }) 
      }));
    } catch (error) {
      console.error("Plan request failed", error);
      toast.error(error.message || "Failed to request plan.");
    }
  };

  const getPendingPlanName = () => {
    if (!userData || !userData.pendingPlanDetails) return null;
    try {
      const details = typeof userData.pendingPlanDetails === 'string' 
        ? JSON.parse(userData.pendingPlanDetails) 
        : userData.pendingPlanDetails;
      return `${details.planName} (₹${details.totalPrice})`;
    } catch (e) {
      return "a plan";
    }
  };

  return (
    <div className="p-4 md:p-8 text-white min-h-screen">
      <h1 className="text-3xl text-center font-bold mb-2 bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
        Subscription Plans
      </h1>
      {discountPercent > 0 && (
        <div className="max-w-2xl mx-auto mb-6 bg-gradient-to-r from-pink-600 to-purple-600 p-1 rounded-xl shadow-lg animate-pulse">
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <p className="text-yellow-300 font-bold text-lg flex items-center justify-center gap-2">
              <FiPercent /> Special Offer Unlocked: Flat {discountPercent}% OFF
              on all plans!
            </p>
          </div>
        </div>
      )}
      <p className="text-center text-gray-400 mb-8">
        Choose a plan to continue using the Dashboard.
      </p>

      {/* Current Status */}
      <div className="max-w-4xl mx-auto mb-10 p-6 bg-black/30 backdrop-blur-2xl border border-purple-500/30 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold text-yellow-400 mb-4">
          Your Current Status
        </h2>
        {!userData ? (
          <div className="flex items-center gap-4 text-gray-300">
            <FiInfo size={32} />
            <div>
              <p className="font-bold text-lg">Guest User</p>
              <p>Please login.</p>
            </div>
          </div>
        ) : userData.paymentStatus === "pending" ? (
          <div className="flex items-center gap-4 text-yellow-300">
            <FiLoader size={32} className="animate-spin" />
            <div>
              <p className="font-bold text-lg">Awaiting Admin Approval</p>
              <p>
                Request sent for{" "}
                <span className="font-bold text-white">
                  {getPendingPlanName()}
                </span>
                . Please wait.
              </p>
            </div>
          </div>
        ) : isSubscriptionActive && expiryDate ? (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-green-400">
              <FiCheckCircle size={40} />
              <div>
                <p className="font-bold text-lg">
                  Plan Active: {userData.activePlan}
                </p>
                <p className="text-sm">
                  Expires on:{" "}
                  {expiryDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <CountdownTimer targetDate={expiryDate} />
          </div>
        ) : (
          <div className="flex items-center gap-4 text-red-400">
            <FiAlertTriangle size={32} />
            <div>
              <p className="font-bold text-lg">Your Plan is Inactive</p>
              <p>Please activate a plan to access the POS dashboard.</p>
            </div>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const basePrice =
            (Number(plan.price) || 0) + (Number(plan.maintenance) || 0);
          const discountAmount = (basePrice * discountPercent) / 100;
          const finalPrice = Math.floor(basePrice - discountAmount);
          // Only disable if status is exactly "pending". If "cancelled", it's enabled.
          const isPending = userData?.paymentStatus === "pending";

          return (
            <div
              key={plan.name}
              className={`relative overflow-hidden bg-black/30 backdrop-blur-2xl border border-${plan.color}-500/30 p-8 rounded-2xl shadow-lg shadow-${plan.color}-500/20 flex flex-col transform transition hover:scale-105 duration-300`}
            >
              {plan.popular && (
                <div className="absolute top-5 right-[-45px] transform rotate-45 bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-1 text-center text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                  Popular
                </div>
              )}
              <h3 className={`text-2xl font-bold text-${plan.color}-400`}>
                {plan.name}
              </h3>
              <div className="my-4">
                <p className="text-3xl font-bold">
                  ₹{plan.price}
                  <span className="text-lg font-normal text-gray-400">
                    {" "}
                    / {plan.duration} days
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-2 text-yellow-300">
                  <span className="text-sm">
                    + ₹{plan.maintenance} Maintenance
                  </span>
                </div>
                <div className="border-t border-dashed border-yellow-400/30 my-3"></div>
                {discountPercent > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-lg line-through decoration-red-500">
                      ₹{basePrice}
                    </span>
                    <div className="flex items-center gap-2">
                      <p className="text-5xl font-bold text-green-400">
                        ₹{finalPrice}
                      </p>
                      <span className="bg-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                        {discountPercent}% OFF
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-5xl font-bold">
                    ₹{basePrice}
                    <span className="text-2xl font-normal text-gray-400">
                      {" "}
                      Total
                    </span>
                  </p>
                )}
              </div>
              <ul className="space-y-2 text-gray-300 mb-6 flex-grow">
                <li>
                  <FiClock className="inline mr-2 text-yellow-400" />{" "}
                  {plan.duration} Days Validity
                </li>
                <li className="font-semibold text-green-400">
                  <FiGift className="inline mr-2" /> {plan.extra} Extra Days{" "}
                  <span className="text-xs font-normal text-yellow-500">
                    (Bonus)
                  </span>
                </li>
              </ul>
              <button
                onClick={() => handleRequestPlan(plan, finalPrice)}
                disabled={isPending}
                className={`w-full mt-auto font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-r from-${
                  plan.color
                }-600 to-${
                  plan.color === "yellow" ? "pink" : "purple"
                }-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isPending ? "Request Pending" : `Buy for ₹${finalPrice}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ViewPlan;
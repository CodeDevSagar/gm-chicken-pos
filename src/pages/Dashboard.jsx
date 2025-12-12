import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import {
  FiTrash2,
  FiPlus,
  FiX,
  FiPrinter,
  FiClock,
  FiCalendar,
  FiLoader,
  FiLock,
  FiShoppingCart,
  FiTag,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiScissors,
  FiBluetooth,
} from "react-icons/fi";
import { toast } from "react-toastify";

// --- IMPORTS FOR SAVING DATA & PRINTING ---
import { databases, AppwriteConfig, ID } from "../appwrite/config";
import {
  connectToPrinter,
  printKOT,
  printCustomerBill,
} from "../utils/BluetoothPrinter";

// --- NEW IMPORT FOR OFFLINE LOGIC ---
import { saveRecord, syncOfflineData } from "../utils/OfflineManager";

const Dashboard = ({ cart, setCart }) => {
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const { user, isSubscriptionActive } = useAuth();
  
  const navigate = useNavigate();

  // --- LOGIC: Product List ---
  const productList = useMemo(() => {
    return settings && settings.products
      ? Object.values(settings.products)
      : [];
  }, [settings]);

  // --- LOGIC: Clock ---
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  // --- LOGIC: Form States ---
  const [selectedProductId, setSelectedProductId] = useState("");
  const [weight, setWeight] = useState("");
  const weightInputRef = useRef(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);



  useEffect(() => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
  });
}, []);

const handleInstallClick = () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt");
      }
      setDeferredPrompt(null);
    });
  }
};

  // --- LOGIC: Offline Sync Listener ---
  useEffect(() => {
    // 1. Try to sync immediately on load
    syncOfflineData();

    // 2. Listen for network recovery
    const handleOnline = () => {
      toast.info("Back Online! Syncing pending bills...");
      syncOfflineData();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Default Product
  useEffect(() => {
    if (productList.length > 0) {
      const isSelectedValid = productList.find(
        (p) => p.id === selectedProductId
      );
      if (!selectedProductId || !isSelectedValid)
        setSelectedProductId(productList[0].id);
    } else {
      setSelectedProductId("");
    }
  }, [productList, selectedProductId]);

  // Auto Focus
  useEffect(() => {
    if (
      window.innerWidth > 768 &&
      selectedProductId &&
      weightInputRef.current &&
      isSubscriptionActive &&
      !isPaymentModalOpen
    ) {
      weightInputRef.current.focus();
    }
  }, [selectedProductId, isSubscriptionActive, isPaymentModalOpen]);

  // --- HELPER VARIABLES & FUNCTIONS ---
  const currentProductData = productList.find(
    (p) => p.id === selectedProductId
  );
  const totalItemsCount = cart.length;
  const calculateRawTotal = () =>
    cart.reduce((total, item) => total + (item.totalPrice || 0), 0);
  const calculateFinalTotal = () =>
    paymentMode === "cash"
      ? Math.round(calculateRawTotal())
      : calculateRawTotal();

  const handleManualAddToCart = (e) => {
    e.preventDefault();
    const wt = parseFloat(weight);
    if (!currentProductData) return toast.error("Please select a product.");
    if (!wt || wt <= 0) return toast.error("Please enter a valid weight.");
    addItemToCart(
      currentProductData,
      wt,
      currentProductData.price,
      wt * currentProductData.price
    );
    setWeight("");
    if (window.innerWidth > 768 && weightInputRef.current)
      weightInputRef.current.focus();
  };

  const handlePredefinedAddToCart = (weightInGrams) => {
    if (!currentProductData) return toast.error("Please select a product.");
    const weightInKg = weightInGrams / 1000;
    addItemToCart(
      currentProductData,
      weightInKg,
      currentProductData.price,
      weightInKg * currentProductData.price
    );
  };

  const addItemToCart = (product, weight, pricePerKg, totalPrice) => {
    const newItem = {
      id: Date.now(),
      name: product.name,
      weight: weight,
      pricePerKg: pricePerKg,
      totalPrice: totalPrice,
      productId: product.id,
    };
    setCart((prevCart) => [...prevCart, newItem]);
    toast.success(`${newItem.name} added!`);
  };

  const handleRemoveFromCart = (id) =>
    setCart(cart.filter((item) => item.id !== id));
  const handleClearCart = () => {
    setCart([]);
    toast.info("Bill cleared.");
  };
  const openPaymentModal = () => {
    if (cart.length === 0) return toast.warn("Cart is empty");
    setPaymentMode("cash");
    setIsPaymentModalOpen(true);
  };

  // =================================================================
  // ⚡ BLUETOOTH & SAVING LOGIC (UPDATED FOR OFFLINE)
  // =================================================================

  const handleConnectPrinter = async () => {
    await connectToPrinter();
  };

  const handleKOTPrint = async () => {
    // KOT doesn't save to DB, just prints. Works offline naturally.
    const success = await printKOT(cart, user, new Date().toISOString());
    if (success) toast.success("KOT Printed");
  };

  const handleUserPrint = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const total = calculateFinalTotal();
    const dateNow = new Date().toISOString();

    try {
      // 1. PREPARE DATA
      const orderData = {
        userId: user.$id || user.userId,
        items: JSON.stringify(cart),
        totalAmount: parseFloat(total),
        paymentMode: paymentMode,
        saleDate: dateNow,
      };

      // 2. SAVE (OFFLINE CAPABLE)
      // This function determines if we are online or offline and saves accordingly
      const saveResult = await saveRecord(
        AppwriteConfig.salesCollectionId, 
        orderData
      );

      // 3. PRINT RECEIPT
      // Bluetooth printing works offline, so we proceed regardless of save mode
      const printSuccess = await printCustomerBill(
        cart,
        total,
        user,
        dateNow,
        paymentMode
      );

      // 4. USER FEEDBACK
      if (printSuccess) {
        if (saveResult.mode === 'offline') {
           toast.info("Printed & Saved Offline (Sync Pending)");
        } else {
           toast.success("Printed & Saved Successfully!");
        }
      } else {
         toast.warn("Saved, but Print Failed");
      }

      // 5. CLEAR & CLOSE
      setCart([]);
      setIsPaymentModalOpen(false);

    } catch (error) {
      console.error(error);
      toast.error("Save Failed: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // =================================================================
  // UI RENDER (UNCHANGED DESIGN)
  // =================================================================

  if (!user || isSettingsLoading)
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-white px-4">
        <div className="relative">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <FiLoader className="text-indigo-400 text-lg md:text-xl" />
          </div>
        </div>
        <span className="mt-4 text-sm md:text-base font-medium text-slate-400 tracking-wide">
          Initializing Dashboard...
        </span>
      </div>
    );

  if (user.paymentStatus === "pending" || !isSubscriptionActive)
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900 p-4">
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-white mb-2">Access Locked</h1>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-white font-sans overflow-x-hidden pb-24 md:pb-0">
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent truncate max-w-[200px]">
            {user?.shopName || "GM POS"}
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-700/50">
          {/* Bluetooth Button */}
          <button
            onClick={handleConnectPrinter}
            className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-600 text-blue-300 border-r border-slate-600 pr-3 mr-1 transition-colors rounded-lg px-2 py-1"
          >
            <FiBluetooth className="text-lg" />
            <span className="hidden md:inline text-xs font-bold uppercase">
              Connect
            </span>
          </button>

          {deferredPrompt && (
  <button onClick={handleInstallClick} className="bg-blue-600 text-white px-4 py-2 rounded">
    Install App
  </button>
)}

          <div className="hidden md:flex items-center gap-2 text-slate-300 border-r border-slate-600 pr-3">
            <FiCalendar className="text-indigo-400" />
            <span className="text-xs font-semibold uppercase">
              {currentTime.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-white md:pl-1">
            <FiClock className="text-cyan-400 text-sm" />
            <span className="text-sm md:text-lg font-mono font-bold">
              {currentTime.toLocaleTimeString("en-IN", {
                hour12: true,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 overflow-y-auto">
        {/* LEFT PANEL */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 md:p-6 shadow-lg relative overflow-hidden">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FiTag className="text-indigo-400" /> New Order Entry
            </h2>

            {productList.length > 0 ? (
              <>
                <div className="mb-4">
                  <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                    Select Product
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setWeight("");
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-white text-base md:text-lg font-medium rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {productList.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-3 mb-4 flex justify-between items-center">
                  <div>
                    <span className="block text-[10px] text-indigo-300 font-bold uppercase">
                      Current Price
                    </span>
                    <span className="text-xl md:text-2xl font-bold text-white tracking-tight">
                      ₹{currentProductData?.price || 0}
                      <span className="text-xs md:text-sm text-indigo-200 font-normal">
                        {" "}
                        / kg
                      </span>
                    </span>
                  </div>
                </div>
                {currentProductData?.type === "weight" && (
                  <form onSubmit={handleManualAddToCart}>
                    <div className="mb-4">
                      <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Enter Weight (KG)
                      </label>
                      <div className="relative">
                        <input
                          id="weight"
                          ref={weightInputRef}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900 border border-slate-700 text-white text-2xl md:text-3xl font-bold rounded-xl py-2 md:py-3 pl-3 pr-10 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
                          KG
                        </span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                      <FiPlus className="text-lg" /> ADD TO BILL
                    </button>
                  </form>
                )}
                {currentProductData?.type === "predefined" && (
                  <div>
                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Quick Add
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {currentProductData.weights.map((w) => (
                        <button
                          key={w}
                          onClick={() => handlePredefinedAddToCart(w)}
                          className="bg-slate-700/50 hover:bg-indigo-600 border border-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-sm active:scale-95"
                        >
                          {w < 1000 ? `${w}g` : `${w / 1000}kg`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">No products found.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-[300px]">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl shadow-xl flex flex-col h-full overflow-hidden">
            <div className="p-3 md:p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                  <FiShoppingCart className="text-indigo-400 text-sm md:text-base" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm md:text-lg">
                    Current Bill
                  </h2>
                  <p className="text-[10px] md:text-xs text-slate-400">
                    {totalItemsCount} Items
                  </p>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-[10px] md:text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-1.5 rounded-md flex items-center gap-1 active:bg-rose-500/20"
                >
                  <FiX /> Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar">
              {cart.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center bg-slate-700/30 border border-slate-700/30 p-2 md:p-3 rounded-lg md:rounded-xl mb-2"
                >
                  <div className="col-span-1 text-center text-slate-500 text-xs hidden md:block">
                    {index + 1}
                  </div>
                  <div className="col-span-7 md:col-span-5 flex flex-col justify-center">
                    <p className="font-bold text-white text-sm md:text-base truncate">
                      {item.name}
                    </p>
                  </div>
                  <div className="col-span-3 text-right hidden md:block">
                    <div className="text-slate-300 text-sm">
                      <span className="font-mono font-bold text-emerald-400">
                        {(item.weight || 0).toFixed(3)}
                      </span>{" "}
                      kg
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-2 text-right">
                    <span className="font-bold text-white text-base md:text-lg">
                      ₹{(item.totalPrice || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="text-slate-500 hover:text-rose-500 p-1 md:p-2 rounded"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[calc(100%-16rem)] z-20 p-3 md:p-4 bg-slate-900 md:bg-transparent">
          <div className="bg-slate-800 md:bg-slate-800/90 backdrop-blur-md border border-indigo-500/30 rounded-xl p-3 md:p-4 shadow-2xl flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">
                Total Amount
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-bold text-white">
                  ₹{calculateRawTotal().toFixed(2)}
                </span>
              </div>
            </div>
            <button
              onClick={openPaymentModal}
              className="flex items-center gap-2 bg-indigo-600 active:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg transition-transform active:scale-95"
            >
              <FiPrinter className="text-lg" />
              <span className="text-sm md:text-base">CHECKOUT</span>
            </button>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsPaymentModalOpen(false)}
          ></div>
          <div className="relative bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fadeInUp">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FiPrinter className="text-indigo-400" /> Finalize Order
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMode("cash")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      paymentMode === "cash"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 text-slate-400"
                    }`}
                  >
                    <FiDollarSign /> Cash
                  </button>
                  <button
                    onClick={() => setPaymentMode("online")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      paymentMode === "online"
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-slate-700 text-slate-400"
                    }`}
                  >
                    <FiCreditCard /> Online
                  </button>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 mb-6 text-center border border-slate-700/50">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                  Total Payable
                </p>
                {paymentMode === "cash" ? (
                  <>
                    <h2 className="text-4xl font-bold text-emerald-400 my-1">
                      ₹{Math.round(calculateRawTotal())}
                    </h2>
                    <span className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-wider">
                      (Rounded Off)
                    </span>
                  </>
                ) : (
                  <h2 className="text-4xl font-bold text-blue-400 my-1">
                    ₹{calculateRawTotal().toFixed(2)}
                  </h2>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  disabled={isProcessing}
                  onClick={handleUserPrint}
                  className="group flex flex-col items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  <FiFileText className="text-2xl" />
                  <span className="font-bold text-sm">USER PRINT</span>
                  <span className="text-[10px] opacity-70 font-medium">
                    Receipt & Save
                  </span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleKOTPrint}
                  className="group flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white py-4 rounded-xl active:scale-95 transition-all"
                >
                  <FiScissors className="text-2xl text-orange-400" />
                  <span className="font-bold text-sm">KOT PRINT</span>
                  <span className="text-[10px] opacity-70 font-medium">
                    Shop Copy (Hold)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
import React, { useState, useRef, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import {
  FiSave, FiUser, FiMail, FiMapPin, FiPhone, FiUpload,
  FiPercent, FiPlus, FiEdit2, FiTrash2, FiLoader, FiFileText,
  FiShoppingBag, FiCheck, FiX, FiBluetooth
} from "react-icons/fi";
import { toast } from "react-toastify";
import { storage, AppwriteConfig, ID } from "../appwrite/config";

// ===================================================================
//  MODAL: Product (Professional Design)
// ===================================================================
const ProductModal = ({ product, mode, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    price: product?.price || "",
    type: product?.type || "weight",
    weights: (product?.weights || []).join(", "),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || parseFloat(formData.price) <= 0) {
      toast.error("Product Name and a valid Price are required.");
      return;
    }

    const finalWeights =
      formData.type === "predefined"
        ? formData.weights
            .split(",")
            .map((w) => parseInt(w.trim()))
            .filter((w) => !isNaN(w) && w > 0)
        : [];

    const dataToSave = {
      ...formData,
      price: parseFloat(formData.price),
      weights: finalWeights,
    };

    onSave(dataToSave, product?.id);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900/50 p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {mode === "add" ? <FiPlus /> : <FiEdit2 />} 
            {mode === "add" ? "Add New Product" : "Edit Product"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <FiX size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Product Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Chicken Breast"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Price Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Price per KG (₹)
            </label>
            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                <input
                type="number"
                name="price"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                />
            </div>
          </div>

          {/* Type Selection (Tabs) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Selling Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`cursor-pointer border rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${formData.type === 'weight' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                <input
                  type="radio"
                  name="type"
                  value="weight"
                  checked={formData.type === "weight"}
                  onChange={handleChange}
                  className="hidden"
                />
                <span className="font-medium">By Weight (KG)</span>
              </label>

              <label className={`cursor-pointer border rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${formData.type === 'predefined' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                <input
                  type="radio"
                  name="type"
                  value="predefined"
                  checked={formData.type === "predefined"}
                  onChange={handleChange}
                  className="hidden"
                />
                <span className="font-medium">Fixed Quantity</span>
              </label>
            </div>
          </div>

          {/* Weights Input (Conditional) */}
          {formData.type === "predefined" && (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Quantities (in grams, comma separated)
              </label>
              <input
                type="text"
                name="weights"
                value={formData.weights}
                onChange={handleChange}
                placeholder="e.g., 100, 250, 500"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <p className="text-[10px] text-slate-500 mt-2">
                Example: enter <span className="text-indigo-400 font-mono">250, 500</span> for 250g & 500g options.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <FiSave /> Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===================================================================
//  PAGE: Shop Settings (Professional Design)
// ===================================================================
const ShopSettings = () => {
  const {
    settings,
    updateShopSettings,
    addProduct,
    updateProduct,
    deleteProduct,
    isLoading: settingsLoading,
  } = useSettings();
  const { user, updateUserProfile } = useAuth();

  // State
  const [localSettings, setLocalSettings] = useState({
    gst: { enabled: false, rate: 18, number: "" },
    bluetooth: false, // --- NEW: Bluetooth State ---
  });
  const [localUser, setLocalUser] = useState({});
  const [shopNameInput, setShopNameInput] = useState(""); 
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [currentProduct, setCurrentProduct] = useState(null);

  // Load Data
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        gst: {
          enabled: settings.gst?.enabled || false,
          rate: settings.gst?.rate || 18,
          number: settings.shopGstNumber || "",
        },
        // --- Load Bluetooth Status ---
        bluetooth: settings.bluetoothEnabled || false 
      });

      if (settings.shopName) {
        setShopNameInput(settings.shopName);
      } else if (settings.shopname) {
        setShopNameInput(settings.shopname);
      }

      if (settings.shopLogoId) {
        try {
          const result = storage.getFilePreview(AppwriteConfig.storageBucketId, settings.shopLogoId);
          setLogoPreview(result.toString());
        } catch (e) { console.error("Logo Error:", e); }
      }
    }

    if (user) {
      setLocalUser(user);
      if (!shopNameInput && (user.shopName || user.shopname)) {
        setShopNameInput(user.shopName || user.shopname);
      }
    }
  }, [settings, user]);

  const handleUserChange = (e) => setLocalUser({ ...localUser, [e.target.name]: e.target.value });
  const handleGstChange = (key, value) => setLocalSettings((prev) => ({ ...prev, gst: { ...prev.gst, [key]: value }, }));
  
  // --- NEW: Toggle Bluetooth ---
  const toggleBluetooth = () => {
      setLocalSettings(prev => ({ ...prev, bluetooth: !prev.bluetooth }));
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);

    try {
      toast.info("Uploading logo...");
      if (settings?.shopLogoId) {
        try { await storage.deleteFile(AppwriteConfig.storageBucketId, settings.shopLogoId); } 
        catch (err) { console.log("Old logo cleanup failed:", err); }
      }
      const response = await storage.createFile(AppwriteConfig.storageBucketId, ID.unique(), file);
      await updateShopSettings({ shopLogoId: response.$id });
      toast.success("Logo updated!");
    } catch (error) {
      console.error(error);
      toast.error("Upload failed: " + error.message);
    }
  };

  // Product Actions
  const openModalForAdd = () => {
    setModalMode("add");
    setCurrentProduct({ name: "", price: "", type: "weight", weights: [] });
    setIsModalOpen(true);
  };
  const openModalForEdit = (product) => {
    setModalMode("edit");
    setCurrentProduct(product);
    setIsModalOpen(true);
  };
  const handleProductSave = (data, id) => {
    modalMode === "add" ? addProduct(data) : updateProduct(id, data);
    setIsModalOpen(false);
  };
  const handleProductDelete = (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) deleteProduct(id);
  };

  // Save All
  const handleSaveAll = async () => {
    try {
      await updateUserProfile({
        name: localUser.name,
        shopAddress: localUser.shopAddress,
        mobile: localUser.mobile,
      });
      await updateShopSettings({
        gstEnabled: localSettings.gst.enabled,
        gstRate: localSettings.gst.rate,
        shopGstNumber: localSettings.gst.number,
        shopName: shopNameInput,
        bluetoothEnabled: localSettings.bluetooth, // --- Saving Bluetooth Status ---
      });
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Save failed: " + error.message);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-white">
        <FiLoader className="animate-spin text-4xl text-indigo-500 mb-4" />
        <span className="text-slate-400">Loading Configuration...</span>
      </div>
    );
  }

  // --- COMPONENT HELPERS ---
  const InputGroup = ({ label, icon: Icon, type = "text", value, onChange, name, disabled = false, placeholder }) => (
    <div className="mb-4">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon className={`${disabled ? 'text-slate-600' : 'text-indigo-400 group-hover:text-indigo-300'} transition-colors`} />
            </div>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`w-full bg-slate-900 border ${disabled ? 'border-slate-800 text-slate-500 cursor-not-allowed' : 'border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'} rounded-xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-slate-700`}
            />
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 md:p-8 pb-24">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Store Configuration</h1>
        <p className="text-slate-400">Manage your business profile, hardware, and product inventory.</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN: SETTINGS --- */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* 1. Profile Card */}
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 pb-4 border-b border-slate-700/50">
                    <FiUser className="text-indigo-400" /> Business Profile
                </h2>
                
                <div className="space-y-1">
                    <InputGroup label="Business Name" icon={FiShoppingBag} value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} placeholder="Enter Shop Name" />
                    <InputGroup label="Owner Name" icon={FiUser} name="name" value={localUser?.name || ""} onChange={handleUserChange} placeholder="Full Name" />
                    <InputGroup label="Email Address" icon={FiMail} name="email" value={localUser?.email || ""} disabled placeholder="Email" />
                    <InputGroup label="Store Address" icon={FiMapPin} name="shopAddress" value={localUser?.shopAddress || ""} onChange={handleUserChange} placeholder="Location" />
                    <InputGroup label="Contact Number" icon={FiPhone} name="mobile" type="tel" value={localUser?.mobile || ""} onChange={handleUserChange} placeholder="Phone" />
                </div>
            </div>

            {/* 2. Configuration Card (Logo, Bluetooth & GST) */}
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 pb-4 border-b border-slate-700/50">
                    <FiEdit2 className="text-indigo-400" /> Brand & Hardware
                </h2>
                
                {/* Logo Upload */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Store Logo</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner group relative">
                            {logoPreview ? (
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <FiUpload className="text-slate-600 text-2xl" />
                            )}
                        </div>
                        <div>
                            <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                            <button onClick={() => fileInputRef.current.click()} className="text-sm bg-slate-700 hover:bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-lg">
                                Upload New Logo
                            </button>
                            <p className="text-[10px] text-slate-500 mt-1">Recommended: 200x200px</p>
                        </div>
                    </div>
                </div>

                {/* --- BLUETOOTH TOGGLE (New) --- */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Hardware Settings</label>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${localSettings.bluetooth ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                                <FiBluetooth size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Bluetooth Printer</p>
                                <p className="text-[10px] text-slate-400">{localSettings.bluetooth ? 'Enabled' : 'Disabled'}</p>
                            </div>
                         </div>
                         <button onClick={toggleBluetooth} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${localSettings.bluetooth ? "bg-blue-600" : "bg-slate-700"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.bluetooth ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                    </div>
                </div>

                {/* GST Settings */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tax Configuration</label>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-slate-300">Enable GST</span>
                            <button onClick={() => handleGstChange("enabled", !localSettings.gst.enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${localSettings.gst.enabled ? "bg-emerald-500" : "bg-slate-700"}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.gst.enabled ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                        </div>
                        
                        {localSettings.gst.enabled && (
                            <div className="space-y-3 animate-fade-in-up">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">GST Rate (%)</label>
                                    <div className="relative mt-1">
                                        <FiPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                        <select 
                                            value={localSettings.gst.rate} 
                                            onChange={(e) => handleGstChange("rate", parseFloat(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg py-2 pl-9 pr-3 outline-none focus:border-emerald-500"
                                        >
                                            {[5, 8, 12, 18, 28].map(r => <option key={r} value={r}>{r}% GST</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">GSTIN Number</label>
                                    <div className="relative mt-1">
                                        <FiFileText className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                        <input 
                                            type="text" 
                                            value={localSettings.gst.number} 
                                            onChange={(e) => handleGstChange("number", e.target.value.toUpperCase())}
                                            placeholder="Ex: 22AAAAA0000A1Z5"
                                            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg py-2 pl-9 pr-3 outline-none focus:border-emerald-500 uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* --- RIGHT COLUMN: PRODUCTS --- */}
        <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-700/50 gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FiShoppingBag className="text-indigo-400" /> Product Inventory
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Manage items available for billing</p>
                    </div>
                    <button onClick={openModalForAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95">
                        <FiPlus size={18} /> Add Product
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {Object.values(settings?.products || {}).length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <div className="bg-slate-800 p-4 rounded-full mb-3"><FiShoppingBag size={32} /></div>
                            <p>No products added yet.</p>
                            <p className="text-sm">Click "Add Product" to get started.</p>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.values(settings?.products || {}).map((product) => (
                                <div key={product.id} className="bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 p-4 rounded-xl transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none transition-transform group-hover:scale-150"></div>
                                    
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-white text-lg mb-1">{product.name}</h3>
                                            <div className="inline-flex items-center gap-2 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-700/50">
                                                <span className="text-indigo-400 font-bold text-sm">₹{product.price}</span>
                                                <span className="text-slate-500 text-xs border-l border-slate-600 pl-2">per kg</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => openModalForEdit(product)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors">
                                                <FiEdit2 size={18} />
                                            </button>
                                            <button onClick={() => handleProductDelete(product.id, product.name)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-700 rounded-lg transition-colors">
                                                <FiTrash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs font-mono text-slate-500">
                                        Type: <span className={product.type === 'weight' ? "text-emerald-400" : "text-amber-400"}>{product.type.toUpperCase()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {isModalOpen && (
        <ProductModal product={currentProduct} mode={modalMode} onClose={() => setIsModalOpen(false)} onSave={handleProductSave} />
      )}

      {/* FLOATING SAVE BUTTON (Sticky on Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 md:relative md:bg-transparent md:border-0 md:p-0 mt-8 z-40">
        <div className="max-w-7xl mx-auto flex justify-end">
             <button
                onClick={handleSaveAll}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 text-lg"
            >
                <FiSave /> SAVE ALL CHANGES
            </button>
        </div>
      </div>
    </div>
  );
};

export default ShopSettings;
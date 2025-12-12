import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { databases, AppwriteConfig, Query, ID } from '../appwrite/config';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const { user } = useAuth();
    const [products, setProducts] = useState({});
    const [shopSettings, setShopSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const getUserId = useCallback(() => {
        if (!user) return null;
        return user.$id || user.userId || user.id;
    }, [user]);

    const fetchAllData = useCallback(async () => {
        const userId = getUserId();
        
        console.log("DEBUG: Checking User ID...", userId); // Check 1

        if (!userId) {
            setProducts({});
            setShopSettings(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            console.log("DEBUG: Fetching Products..."); // Check 2
            
            // 1. Fetch Products
            const productResponse = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.productCollectionId,
                [Query.equal('userId', userId)]
            );
            
            console.log("DEBUG: Products Found:", productResponse.documents.length); // Check 3

            const productsMap = productResponse.documents.reduce((acc, prod) => {
                acc[prod.$id] = { id: prod.$id, ...prod };
                return acc;
            }, {});
            setProducts(productsMap);

            // 2. Fetch Settings
            const settingsResponse = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.settingsCollectionId,
                [Query.equal('userId', userId)]
            );

            if (settingsResponse.documents.length > 0) {
                setShopSettings(settingsResponse.documents[0]);
            } else {
                console.log("DEBUG: Creating Default Settings...");
                const newSettings = await databases.createDocument(
                    AppwriteConfig.databaseId,
                    AppwriteConfig.settingsCollectionId,
                    ID.unique(),
                    { userId: userId, gstEnabled: false, gstRate: 18, shopLogoId: null }
                );
                setShopSettings(newSettings);
            }
        } catch (error) {
            console.error("DEBUG: Error loading data:", error);
            toast.error("Data Load Error: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [getUserId]); 

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // ... (addProduct, updateProduct, deleteProduct, updateShopSettings functions same as before)
    // Code shorten karne ke liye repeat nahi kar raha hu, purana wala same rahega yahan
    
    // Yahan bas Add/Update/Delete functions paste kar dena jo pichle code me the
    const addProduct = useCallback(async (productData) => {
         const userId = getUserId();
         if(!userId) return;
         try {
             const newProductDoc = await databases.createDocument(
                 AppwriteConfig.databaseId, AppwriteConfig.productCollectionId, ID.unique(),
                 { ...productData, userId: userId }
             );
             const newProduct = { id: newProductDoc.$id, ...newProductDoc };
             setProducts(prev => ({ ...prev, [newProduct.id]: newProduct }));
             toast.success("Product added");
         } catch(e) { toast.error(e.message) }
    }, [getUserId]);

    const updateProduct = useCallback(async (id, data) => {
        try {
            const updated = await databases.updateDocument(AppwriteConfig.databaseId, AppwriteConfig.productCollectionId, id, data);
            setProducts(prev => ({ ...prev, [id]: {id: updated.$id, ...updated} }));
            toast.success("Updated");
        } catch(e) { toast.error(e.message) }
    }, []);

    const deleteProduct = useCallback(async (id) => {
        try {
            await databases.deleteDocument(AppwriteConfig.databaseId, AppwriteConfig.productCollectionId, id);
            setProducts(prev => { const n={...prev}; delete n[id]; return n; });
            toast.success("Deleted");
        } catch(e) { toast.error(e.message) }
    }, []);

    const updateShopSettings = useCallback(async (data) => {
        if(!shopSettings) return;
        try {
            const updated = await databases.updateDocument(AppwriteConfig.databaseId, AppwriteConfig.settingsCollectionId, shopSettings.$id, data);
            setShopSettings(updated);
            toast.success("Saved");
        } catch(e) { toast.error(e.message) }
    }, [shopSettings]);

    const settings = useMemo(() => ({
        products,
        gst: shopSettings ? { enabled: shopSettings.gstEnabled, rate: shopSettings.gstRate } : { enabled: false, rate: 18 },
        shopLogoId: shopSettings ? shopSettings.shopLogoId : null
    }), [products, shopSettings]);

    const value = useMemo(() => ({
        settings,
        isLoading,
        addProduct,
        updateProduct,
        deleteProduct,
        updateShopSettings
    }), [settings, isLoading, addProduct, updateProduct, deleteProduct, updateShopSettings]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
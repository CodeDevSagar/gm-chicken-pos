import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { databases, AppwriteConfig, Query, ID, Permission, Role } from '../appwrite/config';
import { useAuth } from './AuthContext';

const PurchaseContext = createContext(undefined);

export const PurchaseProvider = ({ children }) => {
    const { user } = useAuth();
    const [purchases, setPurchases] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- 1. FETCH PURCHASES ---
    const fetchPurchases = useCallback(async (userId) => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const response = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.purchaseCollectionId,
                [Query.equal('userId', userId), Query.orderDesc('purchaseDate')]
            );
            setPurchases(response.documents);
        } catch (error) {
            toast.error("Could not load purchase history: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchPurchases(user.userId);
        } else {
            setPurchases([]);
        }
    }, [user, fetchPurchases]);

    // --- 2. ADD PURCHASE ---
    const addPurchase = useCallback(async (purchaseData) => {
        if (!user?.userId) return;
        try {
            const newPurchase = await databases.createDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.purchaseCollectionId,
                ID.unique(),
                { ...purchaseData, userId: user.userId },
                [
                    Permission.read(Role.user(user.userId)),
                    Permission.update(Role.user(user.userId)),
                    Permission.delete(Role.user(user.userId)),
                ]
            );
            setPurchases(prev => [newPurchase, ...prev]);
            // Toast is handled in UI component usually, but keeping logic consistent
        } catch (error) {
            throw error; // Throw error so UI can catch it
        }
    }, [user]);

    // --- 3. UPDATE PURCHASE (New) ---
    const updatePurchase = useCallback(async (documentId, updatedData) => {
        try {
            const response = await databases.updateDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.purchaseCollectionId,
                documentId,
                updatedData
            );
            
            // Local state update karo taaki refresh na karna pade
            setPurchases(prev => prev.map(item => item.$id === documentId ? response : item));
            
        } catch (error) {
            throw error; // Error ko UI component (ManageStock) handle karega
        }
    }, []);

    // --- 4. DELETE PURCHASE (New) ---
    const deletePurchase = useCallback(async (documentId) => {
        try {
            await databases.deleteDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.purchaseCollectionId,
                documentId
            );

            // Local state se remove karo
            setPurchases(prev => prev.filter(item => item.$id !== documentId));
            
        } catch (error) {
            throw error;
        }
    }, []);

    // --- EXPOSE VALUES ---
    const value = useMemo(() => ({ 
        purchases, 
        addPurchase, 
        updatePurchase, // Added
        deletePurchase, // Added
        isLoading 
    }), [purchases, addPurchase, updatePurchase, deletePurchase, isLoading]);

    return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>;
};

export const usePurchases = () => {
    const context = useContext(PurchaseContext);
    if (context === undefined) {
        throw new Error('usePurchases must be used within a PurchaseProvider');
    }
    return context;
};
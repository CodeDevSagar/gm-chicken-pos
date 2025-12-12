import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { client, account, databases, AppwriteConfig, Query, ID, Permission, Role } from '../appwrite/config';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- Helper: Fetch Profile ---
    const fetchUserProfile = async (accountId) => {
        try {
            // 1. Try fetching by Document ID (Fastest & Best way if IDs match)
            try {
                const doc = await databases.getDocument(
                    AppwriteConfig.databaseId,
                    AppwriteConfig.userCollectionId,
                    accountId
                );
                return doc;
            } catch (e) {
                // If not found by ID, try querying by userId field (Backup way)
                const response = await databases.listDocuments(
                    AppwriteConfig.databaseId,
                    AppwriteConfig.userCollectionId,
                    [Query.equal('userId', accountId)]
                );
                return response.documents.length > 0 ? response.documents[0] : null;
            }
        } catch (error) {
            console.error("Profile fetch failed:", error);
            return null;
        }
    };
    
    // --- 1. Session Check ---
    useEffect(() => {
        const checkActiveSession = async () => {
            try {
                const session = await account.get();
                const profile = await fetchUserProfile(session.$id);
                // Merge session and profile. Profile data overrides session data.
                setUser({ ...session, ...profile });
            } catch (error) {
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkActiveSession();
    }, []);

    // --- 2. Realtime Listener ---
    useEffect(() => {
        if (!user || !user.$id) return;
        const unsubscribe = client.subscribe(
            `databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.userCollectionId}.documents.${user.$id}`,
            (response) => {
                if (response.events.includes('databases.*.collections.*.documents.*.update')) {
                    const updatedData = response.payload;
                    setUser(prevUser => ({ ...prevUser, ...updatedData }));
                    if (updatedData.paymentStatus === 'approved') {
                        toast.success(`Plan Approved: ${updatedData.activePlan}`);
                    }
                }
            }
        );
        return () => { unsubscribe(); };
    }, [user?.$id]);

    // --- 3. Auth Functions ---
    const login = useCallback(async (email, password) => {
        try {
            await account.createEmailPasswordSession(email, password);
            const session = await account.get();
            const profile = await fetchUserProfile(session.$id);
            
            if (!profile) {
                // Agar login ho gaya par profile nahi mili (Data corruption fix)
                toast.error("Profile not found. Please contact admin.");
                await account.deleteSession('current');
                setUser(null);
                return;
            }
            setUser({ ...session, ...profile });
            toast.success("Logged in successfully!");
        } catch(error) {
            toast.error(error.message);
            throw error;
        }
    }, []);

    // --- MAIN FIX IN SIGNUP ---
    const signup = useCallback(async (email, password, name, shopName) => {
        try {
            // A. Create Auth Account
            const newAccount = await account.create(ID.unique(), email, password, name);
            
            // B. Login Immediately
            await account.createEmailPasswordSession(email, password);
            
            // C. Create Database Document
            // IMPORTANT: Hum 'newAccount.$id' ko hi Document ID bana rahe hain.
            // Isse 404 Error kabhi nahi aayega kyunki Auth ID = Database ID.
            const profileData = {
                userId: newAccount.$id,
                email,
                name,
                shopName,
                paymentStatus: 'inactive',
            };

            const permissions = [
                Permission.read(Role.user(newAccount.$id)),
                Permission.update(Role.user(newAccount.$id)),
                Permission.delete(Role.user(newAccount.$id)),
            ];

            const newProfile = await databases.createDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.userCollectionId,
                newAccount.$id, // <--- HERE IS THE FIX (Using Account ID as Doc ID)
                profileData,
                permissions
            );

            const session = await account.get();
            setUser({ ...session, ...newProfile });
            toast.success("Account created! Welcome.");
        } catch(error) {
            console.error("Signup Error:", error);
            toast.error(error.message);
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await account.deleteSession('current');
            toast.info("Logged out.");
        } catch (error) {
            console.error("Logout failed:", error.message);
        } finally {
            setUser(null);
        }
    }, []);
    
    const updateUserProfile = useCallback(async (dataToUpdate) => {
        if (!user || !user.$id) throw new Error("User not found.");
        try {
            const updatedProfile = await databases.updateDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.userCollectionId,
                user.$id, // This will now definitely exist
                dataToUpdate
            );
            setUser(prevUser => ({...prevUser, ...updatedProfile}));
            return updatedProfile;
        } catch (error) {
            toast.error("Update failed: " + error.message);
            throw error;
        }
    }, [user]);

    // --- 4. Sales Function ---
   const saveSale = useCallback(async (cart, totalAmount) => {
        const authId = user?.$id || user?.userId;
        if (!authId) return;

        const saleData = {
            userId: authId,
            saleDate: new Date().toISOString(),
            items: JSON.stringify(cart),
            totalAmount: totalAmount,
        };

        // Permissions handled at table level (Any role)

        try {
            await databases.createDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.salesCollectionId,
                ID.unique(),
                saleData
            );
        } catch (error) {
            console.error("Sales Error:", error);
            if(error.code === 401) toast.error("Check Console Permissions (Sales -> Create)");
            else toast.error("Failed to save bill.");
        }
    }, [user]);

    // --- 5. Subscription Logic ---
  // --- UPDATED FUNCTION ---
    const requestPlanActivation = useCallback(async (plan, calculatedPrice) => {
        if (!user || !user.$id) {
            throw new Error("You must be logged in to request a plan.");
        }
        if (user.paymentStatus === 'pending') {
            toast.warn("You already have a request pending approval.");
            return;
        }
        
        // Agar calculatedPrice ViewPlan se aaya hai toh wo use karo, 
        // nahi toh normal calculation (Fallback)
        const finalPrice = calculatedPrice || (plan.price + plan.maintenance);

        const planDetailsToStore = {
            planName: plan.name,
            duration: plan.duration,
            extra: plan.extra,
            totalPrice: finalPrice, // Save the DISCOUNTED price
        };

        try {
            const updatedProfile = await databases.updateDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.userCollectionId,
                user.$id,
                {
                    paymentStatus: 'pending',
                    pendingPlanDetails: JSON.stringify(planDetailsToStore),
                }
            );
            // State update is handled by Realtime, but explicit update ensures UI feedback
            setUser(prevUser => ({...prevUser, ...updatedProfile}));
            toast.success(`Request sent for ₹${finalPrice}! Waiting for approval.`);
        } catch (error) {
            toast.error("Failed to send request: " + error.message);
            throw error;
        }
    }, [user]);

    // --- 6. Admin Functions ---
    const adminFetchAllUsers = useCallback(async () => {
        try {
            const response = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.userCollectionId,
                [Query.orderDesc('$createdAt')] 
            );
            return response.documents;
        } catch (error) { return []; }
    }, []);

    const adminApprovePlan = useCallback(async (userDoc) => {
        try {
            const plan = JSON.parse(userDoc.pendingPlanDetails);
            let startDate = new Date();
            if (userDoc.planExpiry && new Date(userDoc.planExpiry) > startDate) {
                startDate = new Date(userDoc.planExpiry);
            }
            const totalDuration = (plan.duration || 0) + (plan.extra || 0);
            const newExpiryDate = new Date(startDate);
            newExpiryDate.setDate(startDate.getDate() + totalDuration);

            return await databases.updateDocument(
                AppwriteConfig.databaseId,
                AppwriteConfig.userCollectionId,
                userDoc.$id,
                {
                    paymentStatus: "approved",
                    activePlan: plan.planName,
                    planExpiry: newExpiryDate.toISOString(),
                    pendingPlanDetails: null,
                }
            );
        } catch (err) {
            toast.error("Approval failed: " + err.message);
            throw err;
        }
    }, []);
    
    // --- Computed Values ---
    const isLoggedIn = useMemo(() => !!user, [user]);
    const isSubscriptionActive = useMemo(() => 
        isLoggedIn &&
        user?.paymentStatus === 'approved' && 
        user?.planExpiry && 
        new Date() < new Date(user.planExpiry)
    , [user, isLoggedIn]);
    
    const isAdmin = useMemo(() => user?.email === "admin@example.com", [user]);

    const value = useMemo(() => ({
        user, isLoading, isLoggedIn, isSubscriptionActive, isAdmin,
        login, signup, logout, updateUserProfile, saveSale, requestPlanActivation, adminFetchAllUsers, adminApprovePlan,
    }), [user, isLoading, isLoggedIn, isSubscriptionActive, isAdmin, login, signup, logout, updateUserProfile, saveSale, requestPlanActivation, adminFetchAllUsers, adminApprovePlan]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};


import { databases, AppwriteConfig, ID } from "../appwrite/config";
import { toast } from "react-toastify";


console.log("OfflineManager Loaded. Config:", AppwriteConfig);
// Keys for Local Storage
const OFFLINE_SALES_KEY = "offline_sales_queue";
const OFFLINE_PURCHASES_KEY = "offline_purchases_queue";

// --- SAVE FUNCTION (Replaces databases.createDocument) ---
export const saveRecord = async (collectionId, data) => {
  // Defensive check: ensure collectionId is provided
  if (!collectionId) {
    throw new Error("saveRecord requires collectionId parameter");
  }
  
  console.log(`💾 Saving record to collection: ${collectionId}`);
  const isOnline = navigator.onLine;

  if (isOnline) {
    // 1. If Online, send directly to Appwrite
    try {
      console.log(`📤 Online mode: Sending to Appwrite (DB: ${AppwriteConfig.databaseId}, Col: ${collectionId})`);
      const response = await databases.createDocument(
        AppwriteConfig.databaseId,
        collectionId,
        ID.unique(),
        data
      );
      console.log(`✅ Online save successful`);
      return { success: true, mode: "online", data: response };
    } catch (error) {
      console.error("⚠️ Online save failed, switching to offline...", error);
      // If API fails (e.g., weak signal), fall back to offline logic below
    }
  }

  // 2. If Offline (or API failed), save to Local Storage
  const queueKey =
    collectionId === AppwriteConfig.salesCollectionId
      ? OFFLINE_SALES_KEY
      : OFFLINE_PURCHASES_KEY;

  const existingQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
  
  // Add a temporary ID and timestamp for local display
  const offlineRecord = {
    ...data,
    $id: "TEMP_" + Date.now(), 
    $createdAt: new Date().toISOString(),
    isOffline: true, // Tag to identify it's local
  };

  existingQueue.push(offlineRecord);
  localStorage.setItem(queueKey, JSON.stringify(existingQueue));

  return { success: true, mode: "offline", data: offlineRecord };
};

// --- SYNC FUNCTION (Call this in App.js or Dashboard useEffect) ---
export const syncOfflineData = async () => {
  if (!navigator.onLine) return;

  // 1. Sync Sales
  const salesQueue = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || "[]");
  if (salesQueue.length > 0) {
    toast.info(`Syncing ${salesQueue.length} offline bills...`);
    const failedSales = [];

    for (const sale of salesQueue) {
      try {
        // Remove temporary fields before sending
        const { $id, $createdAt, isOffline, ...cleanData } = sale;
        await databases.createDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.salesCollectionId,
          ID.unique(),
          cleanData
        );
      } catch (error) {
        console.error("Sync failed for sale", error);
        failedSales.push(sale); // Keep it if it fails
      }
    }
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(failedSales));
    if (failedSales.length === 0) toast.success("All offline bills synced!");
  }

  // 2. Sync Purchases (Stock/Salary)
  const purchaseQueue = JSON.parse(localStorage.getItem(OFFLINE_PURCHASES_KEY) || "[]");
  if (purchaseQueue.length > 0) {
    const failedPurchases = [];
    for (const item of purchaseQueue) {
      try {
        const { $id, $createdAt, isOffline, ...cleanData } = item;
        await databases.createDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.purchasesCollectionId, // Ensure this exists in your config
          ID.unique(),
          cleanData
        );
      } catch (error) {
        failedPurchases.push(item);
      }
    }
    localStorage.setItem(OFFLINE_PURCHASES_KEY, JSON.stringify(failedPurchases));
  }
};

// --- GET COMBINED DATA (For History Views) ---
export const getCombinedData = (onlineData, collectionType) => {
  const queueKey = collectionType === 'sales' ? OFFLINE_SALES_KEY : OFFLINE_PURCHASES_KEY;
  const offlineData = JSON.parse(localStorage.getItem(queueKey) || "[]");
  
  // Combine online + offline data, putting offline items at the top
  return [...offlineData, ...onlineData];
};
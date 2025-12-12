import { Client, Account, Databases, Storage, Query, ID, Permission, Role } from 'appwrite';

// Appwrite Configuration
const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1') // Your Appwrite Endpoint
    .setProject('690340bd00369a2ee60e'); // Your project ID
    


// Your Database and Collection IDs
export const AppwriteConfig = {
    databaseId: '691df7bc000445abd06a',
    userCollectionId: 'users',
    productCollectionId: 'products',
    salesCollectionId: 'sales',
    purchaseCollectionId: 'purchases',
    settingsCollectionId: 'settings',
    storageBucketId: '691dfbe7000795afada1' // For shop logos
};


// 2. Services Initialize
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

// 3. EXPORT EVERYTHING (Isme 'client' hona zaroori hai)
export { 
    client,      
    account, 
    databases, 
    storage, 
    Query, 
    ID, 
    Permission, 
    Role 
};
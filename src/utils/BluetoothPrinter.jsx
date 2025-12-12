import { toast } from "react-toastify";

// --- ESC/POS COMMANDS ---
const ESC = "\x1B";
const GS = "\x1D";
const Initialize = ESC + "@";
const AlignCenter = ESC + "a" + "\x01";
const AlignLeft = ESC + "a" + "\x00";
const AlignRight = ESC + "a" + "\x02";
const BoldOn = ESC + "E" + "\x01";
const BoldOff = ESC + "E" + "\x00";
const SmallText = ESC + "M" + "\x01"; // Optional: Small font
const NormalText = ESC + "M" + "\x00";
const Cut = GS + "V" + "\x41" + "\x00";
const Feed = ESC + "d" + "\x02"; 

let bluetoothDevice = null;
let printCharacteristic = null;

// --- 1. CONNECT TO PRINTER ---
export const connectToPrinter = async () => {
  try {
    console.log("Searching for Printer...");
    
    const OPTIONAL_SERVICES = [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "0000ff00-0000-1000-8000-00805f9b34fb",
      "49535343-fe7d-4ae5-8fa9-9fafd205e455",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2"
    ];

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "MT580P" }], 
      optionalServices: OPTIONAL_SERVICES,
      acceptAllDevices: false
    });

    const server = await device.gatt.connect();
    
    // Auto-detect Write Characteristic
    const services = await server.getPrimaryServices();
    let foundChar = null;

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundChar = char;
            break;
          }
        }
      } catch (err) { console.log("Skipping protected service"); }
      if (foundChar) break;
    }

    if (!foundChar) throw new Error("No Write Port Found");

    bluetoothDevice = device;
    printCharacteristic = foundChar;

    device.addEventListener('gattserverdisconnected', () => {
        printCharacteristic = null;
        toast.warn("Printer Disconnected");
    });

    toast.success("Printer Connected!");
    return true;
  } catch (error) {
    console.error("BT Error:", error);
    toast.error("Connection Failed");
    return false;
  }
};

// --- 2. SEND DATA ---
const sendToPrinter = async (dataString) => {
  if (!printCharacteristic) {
    toast.error("Printer Disconnected!");
    return;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const chunkSize = 50; 
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    try {
        await printCharacteristic.writeValue(chunk);
        await new Promise(r => setTimeout(r, 20)); // Buffer delay
    } catch (e) { break; }
  }
};

// --- 3. FORMATTING HELPERS ---
const LINE_WIDTH = 32; // Standard 58mm printer width
const DIVIDER = "-".repeat(LINE_WIDTH) + "\n";

// Helper to center text
const centerText = (text) => {
  const spaces = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
  return " ".repeat(spaces) + text + "\n";
};

// Helper for "Key: Value" pair in one line
const pair = (key, value) => {
  const k = key.toString();
  const v = value.toString();
  const spaceNeeded = LINE_WIDTH - k.length - v.length;
  if (spaceNeeded < 1) return k + " " + v + "\n"; // Fallback if too long
  return k + " ".repeat(spaceNeeded) + v + "\n";
};

// --- 4. PRINT KOT ---
export const printKOT = async (cart, user, date) => {
  if (!printCharacteristic) { toast.error("Connect Printer"); return false; }

  try {
    let text = Initialize + AlignCenter + BoldOn + "KOT (SHOP COPY)\n" + BoldOff;
    text += "--------------------------------\n";
    text += AlignLeft + `Date: ${new Date(date).toLocaleString("en-IN")}\n`;
    text += DIVIDER;
    
    // Simple List for Cutter
    cart.forEach((item) => {
      text += BoldOn + item.name + BoldOff + "\n"; // Item Name Line 1
      text += AlignRight + `Qty: ${item.weight}kg` + AlignLeft + "\n"; // Weight Line 2
      text += "- - - - - - - - - - - - - - - - \n";
    });

    text += "\n" + AlignCenter + "Internal Use Only\n";
    text += Feed + Cut;

    await sendToPrinter(text);
    return true;
  } catch (e) { return false; }
};

// --- 5. PRINT CUSTOMER BILL (UPDATED WITH ALL DETAILS) ---
export const printCustomerBill = async (cart, total, user, date, paymentMode) => {
  if (!printCharacteristic) { toast.error("Connect Printer"); return false; }

  // Generate Invoice Number (Time based random short ID)
  const invoiceNo = "INV-" + Math.floor(Date.now() / 1000).toString().slice(-6);

  try {
    // --- HEADER ---
    let text = Initialize + AlignCenter;
    text += BoldOn + (user?.shopName || "MEAT SHOP") + "\n" + BoldOff; // SHOP NAME
    
    if (user?.address) text += user.address + "\n"; // ADDRESS
    if (user?.phone) text += "Mob: " + user.phone + "\n"; // MOBILE
    if (user?.email) text += "Email: " + user.email + "\n"; // EMAIL
    
    text += DIVIDER;
    
    // --- META DATA ---
    text += AlignLeft;
    text += pair("Inv No:", invoiceNo);
    text += pair("Date:", new Date(date).toLocaleDateString("en-IN"));
    text += pair("Time:", new Date(date).toLocaleTimeString("en-IN"));
    text += pair("Mode:", paymentMode.toUpperCase());
    
    text += DIVIDER;
    
    // --- ITEMS TABLE ---
    // Layout: 
    // Item Name (Bold)
    // Weight x Price/kg          Total
    
    text += BoldOn + "ITEM DETAILS" + BoldOff + "\n";
    text += DIVIDER;

    cart.forEach((item) => {
      // Line 1: Item Name
      text += AlignLeft + BoldOn + item.name + BoldOff + "\n";
      
      // Line 2: Details
      // Format: 1.500kg x 200      300.00
      const qtyPart = `${item.weight}kg x ${item.pricePerKg}`;
      const totalPart = item.totalPrice.toFixed(2);
      
      text += pair(qtyPart, totalPart);
    });

    text += DIVIDER;

    // --- TOTALS ---
    text += BoldOn + pair("TOTAL AMOUNT:", "Rs. " + total) + BoldOff;
    text += DIVIDER;

    // --- FOOTER ---
    text += AlignCenter;
    text += "Thank You for Visiting!\n";
    text += "Have a Nice Day\n";
    text += "\n\n";
    text += Feed + Cut;

    await sendToPrinter(text);
    return true;
  } catch (e) {
    console.error(e);
    toast.error("Print Failed");
    return false;
  }
};
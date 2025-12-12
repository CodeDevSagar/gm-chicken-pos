import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext'; // Step 1: Import useAuth

/**
 * POSView Component
 * Displays a print-friendly receipt preview.
 * After printing, it saves the transaction to the Appwrite database,
 * then clears the cart, and finally navigates the user back to the dashboard.
 * 
 * @param {object} props - Component props
 * @param {Array} props.cart - The array of items in the current bill.
 * @param {Function} props.setCart - The function to update the cart state.
 */
const POSView = ({ cart, setCart }) => {
  const navigate = useNavigate();
  const { saveSale } = useAuth(); // Step 2: Get the saveSale function

  // Function to calculate the total amount of the cart
  const calculateTotal = () => cart.reduce((total, item) => total + (item.totalPrice || 0), 0);
  
  // Function to trigger the browser's print dialog
  const handlePrint = () => {
    if (!cart || cart.length === 0) {
      alert("Cannot print an empty bill!");
      return;
    }
    window.print();
  };

  // This hook handles all the automation after the print dialog is closed.
  useEffect(() => {
    const handleAfterPrint = async () => {
      if (!cart || cart.length === 0) {
        navigate('/');
        return;
      }

      // Step 3: Save the current sale to the Appwrite database
      const totalAmount = calculateTotal();
      await saveSale(cart, totalAmount); // Await the async database operation

      // Step 4: Clear the cart
      setCart([]);
      
      // Step 5: Navigate back to the dashboard for the next sale
      navigate('/');
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    // IMPORTANT: Add saveSale to the dependency array
  }, [cart, setCart, navigate, saveSale]);

  // The rest of your JSX remains exactly the same...
  return (
    <div className="p-4 md:p-8 flex flex-col items-center text-white min-h-screen pb-32">
      
      {/* Page Header (Non-printable) */}
      <div className="w-full max-w-sm mx-auto text-center mb-6 no-print">
        <h1 className="text-3xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
          Print Preview
        </h1>
        <p className="text-yellow-400 text-sm mt-1">This is how your receipt will look.</p>
      </div>
      
      {/* Receipt Area (Printable) */}
      <div className="print-area bg-gray-50 text-black font-mono w-full max-w-xs p-4 shadow-2xl shadow-purple-500/20 rounded-md">
        {/* Shop Details */}
        <div className="text-center">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {/* You can get shop details from settings context later if needed */}
            GM POS Shop 
          </h2>
          <p className="text-xs text-gray-600">123, Chicken Market, City</p>
          <p className="text-xs text-gray-600">Phone: 9876543210</p>
          <hr className="my-2 border-dashed border-gray-400" />
        </div>
        
        {/* Date and Time */}
        <div className="text-xs text-gray-700">
          <p>Date: {new Date().toLocaleDateString()}</p>
          <p>Time: {new Date().toLocaleTimeString()}</p>
        </div>
        
        <hr className="my-2 border-dashed border-gray-400" />
        
        {/* Items List */}
        <div>
          <div className="grid grid-cols-4 font-bold text-xs text-gray-800">
            <span className="col-span-2">ITEM</span>
            <span className="text-center">QTY</span>
            <span className="text-right">PRICE</span>
          </div>
          {cart && cart.length > 0 ? cart.map(item => (
            <div key={item.id} className="grid grid-cols-4 text-xs my-1.5">
              <span className="col-span-2 break-words">{item.name}</span>
              <span className="text-center">{(item.weight || 0).toFixed(2)}kg</span>
              <span className="text-right font-semibold">₹{(item.totalPrice || 0).toFixed(2)}</span>
            </div>
          )) : <p className='text-center col-span-4 py-4 text-gray-500'>No items in cart.</p>}
        </div>
        
        <hr className="my-2 border-dashed border-gray-400" />
        
        {/* Total Amount */}
        <div className="flex justify-between items-center font-bold text-xl text-pink-600">
          <span>TOTAL</span>
          <span>₹{calculateTotal().toFixed(2)}</span>
        </div>
        
        <hr className="my-2 border-dashed border-gray-400" />
        
        {/* Footer with QR Code */}
        <div className="text-center mt-4">
            <svg className="w-20 h-20 mx-auto" viewBox="0 0 256 256">
              <path fill="black" d="M140 184h28v28h-28zm-56-56h28v28H84zm56 0h28v28h-28zm56-56h28v28h-28zm-56 0h28v28h-28zM84 72h28v28H84zm56 0h28v28h-28zM84 16h28v28H84z m-28 84h28v28H56zm0-56h28v28H56z m-28 28h28v28H28zM56 16h28v28H56zm140 140h28v28h-28zm-84 56h28v28h-28zm56 0h28v28h-28zm56-56h28v28h-28zM28 84h28v28H28zm0-56h28v28H28z m168 112h28v28h-28z M28 140h28v28H28zm0 56h28v28H28z m112-56h28v28h-28zm-56-56H56V84h28v28z M56 56H28V28h28v28zm140 0h-28V28h28v28zM56 196H28v-28h28v28zm140-56h-28v-28h28v28z M0 0v256h256V0H0zm228 228H28V28h200v200z"/>
            </svg>
            <p className="text-xs text-gray-600 mt-2">Scan to pay or visit our website</p>
            <p className="font-semibold text-xs mt-4">Thank you for your shopping!</p>
        </div>
      </div>

      {/* Floating Footer (Non-printable) */}
      <div className="no-print fixed bottom-0 left-0 right-0 md:left-auto md:w-[calc(100%-16rem)] bg-black/50 backdrop-blur-xl border-t border-white/20 p-4 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="w-1/3 md:w-auto flex items-center justify-center gap-2 bg-black/30 border border-yellow-400/50 text-yellow-300 font-semibold py-3 px-5 rounded-xl hover:bg-yellow-400/10 transition-colors duration-300"
          >
            <FiArrowLeft />
            <span className='hidden md:inline'>Back to POS</span>
          </button>
          <button 
            onClick={handlePrint} 
            className="w-2/3 md:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:-translate-y-1"
          >
            <FiPrinter size={20} />
            Print Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSView;
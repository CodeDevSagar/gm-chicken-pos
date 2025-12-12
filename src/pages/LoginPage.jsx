import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiMail, FiLock, FiLogIn, FiLoader, FiUser, FiShoppingBag } from 'react-icons/fi';

const LoginPage = () => {
    const { login, signup } = useAuth();
    const navigate = useNavigate();

    // State for toggling between Login and Sign Up
    const [isLoginView, setIsLoginView] = useState(true);
    
    // State for form fields and loading status
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For signup
    const [shopName, setShopName] = useState(''); // For signup
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLoginView) {
                // --- Login Logic ---
                if (!email || !password) {
                    toast.error("Please enter both email and password.");
                    setIsLoading(false);
                    return;
                }
                await login(email, password);
                navigate('/'); // Redirect to dashboard on successful login
            } else {
                // --- Sign Up Logic ---
                if (!email || !password || !name || !shopName) {
                    toast.error("Please fill out all fields to sign up.");
                    setIsLoading(false);
                    return;
                }
                await signup(email, password, name, shopName);
                navigate('/'); // Redirect to dashboard on successful signup
            }
        } catch (error) {
            // Error toast is already handled in the AuthContext, so we just stop loading
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-900 p-4 text-white">
            <div className="w-full max-w-md mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-l from-purple-500 to-pink-500 bg-clip-text text-transparent">
                        Welcome to GM POS
                    </h1>
                    <p className="text-yellow-300 mt-2">
                        {isLoginView ? "Log in to access your dashboard" : "Create your account to get started"}
                    </p>
                </div>

                <div className="bg-black/30 backdrop-blur-2xl border border-purple-500/30 p-8 rounded-2xl shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* --- Fields for Sign Up Only --- */}
                        {!isLoginView && (
                            <>
                                <div className="relative">
                                    <FiUser className="absolute top-1/2 left-4 -translate-y-1/2 text-yellow-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your Full Name"
                                        className="w-full bg-black/20 border text-pink-400 border-yellow-400/30 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                </div>
                                <div className="relative">
                                    <FiShoppingBag className="absolute top-1/2 left-4 -translate-y-1/2 text-yellow-400" />
                                    <input
                                        type="text"
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        placeholder="Your Shop's Name"
                                        className="w-full bg-black/20 border text-pink-400 border-yellow-400/30 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                </div>
                            </>
                        )}
                        
                        {/* --- Common Fields --- */}
                        <div className="relative">
                            <FiMail className="absolute top-1/2 left-4 -translate-y-1/2 text-yellow-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address"
                                className="w-full bg-black/20 border text-pink-400 border-yellow-400/30 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div className="relative">
                            <FiLock className="absolute top-1/2 left-4 -translate-y-1/2 text-yellow-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full bg-black/20 border text-pink-400 border-yellow-400/30 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>

                        {/* --- Submit Button --- */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <FiLoader className="animate-spin" />
                            ) : (
                                <FiLogIn />
                            )}
                            <span>{isLoginView ? 'Log In' : 'Sign Up'}</span>
                        </button>
                    </form>

                    {/* --- Toggle View Link --- */}
                    <div className="text-center mt-6">
                        <button
                            onClick={() => setIsLoginView(!isLoginView)}
                            className="text-yellow-400 hover:text-pink-400 text-sm font-semibold transition-colors"
                        >
                            {isLoginView
                                ? "Don't have an account? Sign Up"
                                : "Already have an account? Log In"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
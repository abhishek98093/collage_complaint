import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { sendOtp, verifyOtp, login, resetPassword } from "../apicalls/authapi";
import { toast } from 'react-toastify';
import { useDispatch } from "react-redux";
import FloatingBackground from "../components/FloatingBackground";
import { useMutation } from "@tanstack/react-query";
import { setUser } from "../slices/userSlice";
import LoadingPage from "../components/LoadingPage";

const loginSchema = z.object({
    email: z.string({ required_error: "Email is required" }).email("Invalid email address"),
    password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

const forgotSchema = z.object({
    email: z.string().email("Invalid email address"),
});

const strongPasswordSchema = z.object({
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must include an uppercase letter")
        .regex(/[a-z]/, "Must include a lowercase letter")
        .regex(/[0-9]/, "Must include a digit")
        .regex(/[^A-Za-z0-9]/, "Must include a special character"),
    cnfpassword: z.string(),
}).refine(data => data.password === data.cnfpassword, {
    message: "Passwords do not match",
    path: ['cnfpassword'],
});

// ✅ Reusable role-based navigation helper
const navigateByRole = (role, navigate) => {
    switch (role) {
        case "admin":
            navigate("/admin/dashboard", { replace: true });
            break;
        case "user":
            navigate("/user/dashboard", { replace: true });
            break;
        case "worker":
            navigate("/worker/dashboard", { replace: true });
            break;
        default:
            toast.error("Invalid role. Redirecting to login.");
            localStorage.removeItem("token");
            navigate("/login");
    }
};

function LoginPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(0);
    const [forgot, setForgot] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpToken, setOtpToken] = useState(""); // ✅ store otpToken from verifyOtp
    const [otpsent, setOtpSent] = useState(false);
    const [step, setStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
    });

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        cnfpassword: "",
    });

    const checkPasswordStrength = (password) => {
        setPasswordStrength({
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'password') checkPasswordStrength(value);
    };

    // ✅ Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // ✅ Fixed: pass email and type as separate args
    const sendOtpMutation = useMutation({
        mutationFn: async (email) => {
            const parseResult = forgotSchema.safeParse({ email });
            if (!parseResult.success) {
                throw new Error('Enter a valid email ID');
            }
            const result = await sendOtp(email, 'reset'); // ✅ separate args
            if (!result.success) {
                throw new Error(result.message || 'Failed to send OTP');
            }
            return result;
        },
        onSuccess: () => {
            setOtpSent(true);
            setCountdown(30);
            setStep(2);
        },
        onError: (error) => {
            toast.error(error.message || 'Something went wrong while sending OTP');
        },
    });

    // ✅ Fixed: pass args separately, save otpToken
    const verifyOtpMutation = useMutation({
        mutationFn: async ({ email, otp, type }) => {
            if (!email || !otp || !type) {
                throw new Error("Email, OTP, and type are required.");
            }
            const result = await verifyOtp(email, otp, type); // ✅ separate args
            if (!result.success) {
                throw new Error(result.message || 'OTP verification failed');
            }
            return result;
        },
        onSuccess: (data) => {
            setOtpToken(data.otpToken); // ✅ save for reset password step
            setOtp("");
            setStep(3);
        },
        onError: (error) => {
            toast.error(error.message || "Something went wrong during OTP verification.");
        },
    });

    // ✅ Fixed: pass email and password as separate args, include otpToken
    const resetPasswordMutation = useMutation({
        mutationFn: async ({ email, password, cnfpassword }) => {
            if (password !== cnfpassword) {
                throw new Error('Passwords do not match');
            }
            const parseResult = strongPasswordSchema.safeParse({ password, cnfpassword });
            if (!parseResult.success) {
                throw new Error(parseResult.error.errors[0]?.message || 'Password is not strong enough');
            }
            if (!otpToken) {
                throw new Error('OTP verification token missing. Please verify OTP again.');
            }
            const result = await resetPassword(email, password, otpToken); // ✅ separate args + otpToken
            if (!result.success) {
                throw new Error(result.message || 'Password reset failed');
            }
            return result;
        },
        onSuccess: (result) => {
            toast.success('Password reset successful. Logging you in...');
            dispatch(setUser({
                user: result.user,
                workerDetails: result.workerDetails || null,
                logedAt: Date.now(),
            }));
            navigateByRole(result.user?.role, navigate); // ✅ correct roles
        },
        onError: (error) => {
            toast.error(error.message || 'Something went wrong during password reset');
        },
    });

    // ✅ Fixed: pass email and password as separate args
    // In your LoginPage.jsx, update the loginMutation onSuccess:

    // In your LoginPage.jsx, update the loginMutation:

const loginMutation = useMutation({
  mutationFn: async ({ email, password }) => {
    const parseResult = loginSchema.safeParse({ email, password });
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || "Enter valid email and password");
    }
    const result = await login(email, password);
    if (!result.success) {
      throw new Error(result.message || 'Login failed');
    }
    return result;
  },
  onSuccess: (result) => {
    const { token, user } = result;
    
    console.log('🔐 Login successful:', { 
      role: user?.role, 
      name: user?.name,
      email: user?.email 
    });
    
    // Verify user has role
    if (!user?.role) {
      console.error('❌ User object missing role!', user);
      toast.error('Invalid user data. Please contact support.');
      return;
    }
    
    // Dispatch to Redux
    dispatch(setUser({
      user: user,
      token: token,
      logedAt: Date.now(),
    }));
    
    toast.success(`Welcome ${user.name}!`);
    
    // Small delay to ensure Redux state is updated
    setTimeout(() => {
      const role = user.role;
      console.log('🚀 Navigating based on role:', role);
      
      switch (role) {
        case "admin":
          navigate("/admin/dashboard", { replace: true });
          break;
        case "user":
          navigate("/user/dashboard", { replace: true });
          break;
        case "worker":
          navigate("/worker/dashboard", { replace: true });
          break;
        default:
          console.error('❌ Unknown role:', role);
          toast.error("Invalid role. Redirecting to login.");
          dispatch(resetUser());
          navigate("/login");
      }
    }, 200);
  },
  onError: (error) => {
    console.error('❌ Login error:', error);
    toast.error(error.message || "Invalid email or password");
  },
});

    const handleLogin = (e) => {
        e.preventDefault();
        loginMutation.mutate({ email: formData.email, password: formData.password });
    };

    const handleSendOtp = (e) => {
        e.preventDefault();
        sendOtpMutation.mutate(formData.email); // ✅ pass string directly
    };

    const handleVerifyOtp = (e) => {
        e.preventDefault();
        verifyOtpMutation.mutate({ email: formData.email, otp, type: "reset" });
    };

    const handleResetPassword = (e) => {
        e.preventDefault();
        resetPasswordMutation.mutate({
            email: formData.email,
            password: formData.password,
            cnfpassword: formData.cnfpassword,
        });
    };

    const handleBackToLogin = () => {
        setForgot(false);
        setStep(1);
        setOtp("");
        setOtpToken("");
        setOtpSent(false);
        setCountdown(0);
    };

    if (
        resetPasswordMutation.isPending ||
        verifyOtpMutation.isPending ||
        sendOtpMutation.isPending ||
        loginMutation.isPending
    ) {
        return <LoadingPage status="load" message="Please wait..." />;
    }

    return (
        <div className="relative min-h-screen bg-white overflow-hidden">
            <FloatingBackground />
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl p-6 sm:p-8 md:p-10 w-full max-w-md border border-gray-200">
                    <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        {forgot ? 'Reset Password' : 'Welcome Back!'}
                    </h2>
                    <p className="text-center text-gray-500 mb-8">
                        {forgot ? 'Follow the steps to reset your password.' : 'Sign in to continue to Complaint System.'}
                    </p>

                    <form
                        onSubmit={
                            forgot
                                ? step === 3 ? handleResetPassword : (e) => e.preventDefault()
                                : handleLogin
                        }
                        className="space-y-4"
                    >
                        {/* --- LOGIN VIEW --- */}
                        {!forgot && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-600">Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-sm font-medium mb-1 text-gray-600">Password *</label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12 transition-shadow"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(prev => !prev)}
                                        className="absolute right-0 top-7 h-10 px-3 text-sm text-purple-600 hover:text-purple-800 font-semibold"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForgot(true)}
                                        className="mt-1 text-sm text-purple-600 hover:underline float-right"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loginMutation.isPending}
                                        className="w-full text-white py-3 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-70"
                                    >
                                        {loginMutation.isPending ? 'Logging In...' : 'Log In'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* --- FORGOT PASSWORD FLOW --- */}
                        {forgot && (
                            <>
                                {/* Step 1: Send OTP */}
                                {step === 1 && (
                                    <div className="grid grid-cols-3 gap-4 items-end">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium mb-1 text-gray-600">Email *</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="you@example.com"
                                                required
                                            />
                                        </div>
                                        <button
                                            onClick={handleSendOtp}
                                            disabled={sendOtpMutation.isPending}
                                            type="button"
                                            className="w-full text-white py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-70"
                                        >
                                            {sendOtpMutation.isPending ? '...' : 'Send OTP'}
                                        </button>
                                    </div>
                                )}

                                {/* Step 2: Verify OTP */}
                                {step === 2 && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-gray-600">Email *</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                readOnly
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-end">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium mb-1 text-gray-600">Enter OTP *</label>
                                                <input
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    placeholder="123456"
                                                    maxLength={6}
                                                    required
                                                />
                                            </div>
                                            <button
                                                onClick={handleVerifyOtp}
                                                disabled={verifyOtpMutation.isPending}
                                                type="button"
                                                className="w-full text-white py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-70"
                                            >
                                                {verifyOtpMutation.isPending ? '...' : 'Verify OTP'}
                                            </button>
                                        </div>

                                        {/* Resend OTP */}
                                        <div className="text-sm text-gray-600">
                                            <button
                                                type="button"
                                                onClick={() => sendOtpMutation.mutate(formData.email)}
                                                disabled={countdown > 0 || sendOtpMutation.isPending}
                                                className={`font-medium hover:underline ${
                                                    countdown > 0 || sendOtpMutation.isPending
                                                        ? 'text-gray-400 cursor-not-allowed'
                                                        : 'text-purple-600'
                                                }`}
                                            >
                                                {countdown > 0
                                                    ? `Resend OTP in ${countdown}s`
                                                    : sendOtpMutation.isPending
                                                        ? 'Sending...'
                                                        : 'Resend OTP'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Step 3: New Password */}
                                {step === 3 && (
                                    <>
                                        <div className="relative">
                                            <label className="block text-sm font-medium mb-1 text-gray-600">New Password *</label>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12"
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(prev => !prev)}
                                                className="absolute right-0 top-7 h-10 px-3 text-sm text-purple-600 hover:text-purple-800 font-semibold"
                                            >
                                                {showPassword ? 'Hide' : 'Show'}
                                            </button>
                                            {formData.password && (
                                                <div className="mt-2 space-y-1 text-sm">
                                                    <p className={passwordStrength.length ? 'text-green-600' : 'text-gray-500'}>✓ At least 8 characters</p>
                                                    <p className={passwordStrength.uppercase ? 'text-green-600' : 'text-gray-500'}>✓ Uppercase letter</p>
                                                    <p className={passwordStrength.lowercase ? 'text-green-600' : 'text-gray-500'}>✓ Lowercase letter</p>
                                                    <p className={passwordStrength.number ? 'text-green-600' : 'text-gray-500'}>✓ Number</p>
                                                    <p className={passwordStrength.special ? 'text-green-600' : 'text-gray-500'}>✓ Special character</p>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-gray-600">Confirm Password *</label>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="cnfpassword"
                                                value={formData.cnfpassword}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="••••••••"
                                                required
                                            />
                                            {formData.cnfpassword && formData.password !== formData.cnfpassword && (
                                                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                                            )}
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={resetPasswordMutation.isPending}
                                                className="w-full text-white py-3 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-70"
                                            >
                                                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={handleBackToLogin}
                                    className="w-full text-center pt-2 text-sm text-gray-500 hover:underline"
                                >
                                    Back to Log In
                                </button>
                            </>
                        )}
                    </form>
                </div>

                {!forgot && (
                    <div className="text-center mt-6">
                        <p className="text-gray-600">
                            Don't have an account?{' '}
                            <button
                                onClick={() => navigate('/signup')}
                                className="inline font-semibold text-purple-600 hover:underline focus:outline-none"
                            >
                                Sign Up
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoginPage;
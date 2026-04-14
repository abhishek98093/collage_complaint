import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { sendOtp, verifyOtp, signup } from "../apicalls/authapi";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { setUser } from "../slices/userSlice";
import FloatingBackground from "../components/FloatingBackground";
import { useMutation } from "@tanstack/react-query";
import LoadingPage from "../components/LoadingPage";
import ErrorPage from "../components/ErrorPage";

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
  path: ["cnfpassword"],
});

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

function SignupPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState(""); // ✅ store otpToken from verifyOtp
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    dob: "",
    phone_number: "", // ✅ renamed to match backend
    password: "",
    cnfpassword: "",
  });

  // ✅ Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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
    if (name === "password") checkPasswordStrength(value);
  };

  // ✅ Send OTP — passes email and type as separate args
  const sendOtpMutation = useMutation({
    mutationFn: async (email) => {
      const parseResult = emailSchema.safeParse({ email });
      if (!parseResult.success) {
        throw new Error("Enter a valid email ID");
      }
      const result = await sendOtp(email, "signup");
      if (!result.success) {
        throw new Error(result.message || "Failed to send OTP");
      }
      return result;
    },
    onSuccess: () => {
      setOtpSent(true);
      setCountdown(30);
      setStep(2);
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong while sending OTP");
    },
  });

  // ✅ Verify OTP — passes args separately, saves otpToken
  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, otp, type }) => {
      if (!email || !otp || !type) {
        throw new Error("Email, OTP, and type are required.");
      }
      const result = await verifyOtp(email, otp, type);
      if (!result.success) {
        throw new Error(result.message || "OTP verification failed");
      }
      return result;
    },
    onSuccess: (data) => {
      setOtpToken(data.otpToken); // ✅ save for signup step
      setOtp("");
      setStep(3);
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong during OTP verification.");
    },
  });

  // ✅ Signup — sends phone_number and otpToken correctly
  const signupMutation = useMutation({
    mutationFn: async ({ name, email, password, cnfpassword, phone_number, dob }) => {
      if (!name || !email || !phone_number || !dob) {
        throw new Error("All fields are required");
      }

      const parseResult = strongPasswordSchema.safeParse({ password, cnfpassword });
      if (!parseResult.success) {
        throw new Error(parseResult.error.errors[0]?.message || "Password is not strong enough");
      }

      if (!otpToken) {
        throw new Error("OTP verification token missing. Please verify OTP again.");
      }

      const result = await signup({
        name,
        email,
        password,
        cnfpassword,
        phone_number, // ✅ matches backend field name
        dob,
        otpToken,     // ✅ required by backend
      });

      if (!result.success) {
        throw new Error(result.message || "Signup failed");
      }
      return result;
    },
    onSuccess: (result) => {
  dispatch(setUser({
    user: result.user,
    workerDetails: result.workerDetails || null,
    logedAt: Date.now(),
  }));
  toast.success("Signup successful. Logging you in...");
  
  const role = result.user?.role;
  switch (role) {
    case "admin":
      navigate("/admin/dashboard", { replace: true });
      break;
    case "worker":
      navigate("/worker/dashboard", { replace: true });
      break;
    case "user":
      navigate("/user/dashboard", { replace: true });
      break;
    default:
      toast.error("Invalid role. Redirecting to login.");
      localStorage.removeItem("token");
      navigate("/login");
  }
},
    onError: (error) => {
      toast.error(error.message || "Something went wrong during signup");
    },
  });

  const handleSendOtp = (e) => {
    e.preventDefault();
    sendOtpMutation.mutate(formData.email);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    verifyOtpMutation.mutate({ email: formData.email, otp, type: "signup" });
  };

  const handleResendOtp = () => {
    sendOtpMutation.mutate(formData.email);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    signupMutation.mutate({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      cnfpassword: formData.cnfpassword,
      phone_number: formData.phone_number, // ✅ correct field name
      dob: formData.dob,
    });
  };

  if (signupMutation.isPending) return <LoadingPage status="load" message="Creating account, please wait" />;
  if (signupMutation.isError) return <ErrorPage message={signupMutation.error?.message || "Something went wrong"} />;

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <FloatingBackground />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl p-6 sm:p-8 md:p-10 w-full max-w-md border border-gray-200">
          <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">Sign Up</h2>

          {/* Step Indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition-all ${step >= s ? "bg-indigo-600" : "bg-gray-200"}`}
              />
            ))}
          </div>

          <form
            onSubmit={step === 3 ? handleSignUp : step === 2 ? handleVerifyOtp : handleSendOtp}
            className="space-y-4"
          >
            {/* ── Step 1: Email ── */}
            {step === 1 && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@example.com"
                  required
                />
                <button
                  type="submit"
                  disabled={sendOtpMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg mt-3 font-medium transition-all disabled:opacity-60"
                >
                  {sendOtpMutation.isPending ? "Sending OTP..." : "Send OTP"}
                </button>
              </div>
            )}

            {/* ── Step 2: OTP Verification ── */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1 text-gray-600">Enter OTP *</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="123456"
                      maxLength={6}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyOtpMutation.isPending}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-60"
                  >
                    {verifyOtpMutation.isPending ? "..." : "Verify"}
                  </button>
                </div>

                {/* Resend OTP */}
                <div className="text-sm text-gray-600">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || sendOtpMutation.isPending}
                    className={`font-medium hover:underline ${
                      countdown > 0 || sendOtpMutation.isPending
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-indigo-600"
                    }`}
                  >
                    {countdown > 0
                      ? `Resend OTP in ${countdown}s`
                      : sendOtpMutation.isPending
                      ? "Sending..."
                      : "Resend OTP"}
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: User Details ── */}
            {step === 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Date of Birth *</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone_number"  // ✅ matches backend + formData key
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="9876543210"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <div className="mt-2 text-xs space-y-1">
                    <p className={passwordStrength.length ? "text-green-600" : "text-gray-400"}>✔ At least 8 characters</p>
                    <p className={passwordStrength.uppercase ? "text-green-600" : "text-gray-400"}>✔ Uppercase letter</p>
                    <p className={passwordStrength.lowercase ? "text-green-600" : "text-gray-400"}>✔ Lowercase letter</p>
                    <p className={passwordStrength.number ? "text-green-600" : "text-gray-400"}>✔ Number</p>
                    <p className={passwordStrength.special ? "text-green-600" : "text-gray-400"}>✔ Special character</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Confirm Password *</label>
                  <input
                    type="password"
                    name="cnfpassword"
                    value={formData.cnfpassword}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  {formData.cnfpassword && formData.password !== formData.cnfpassword && (
                    <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={signupMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg mt-2 font-medium transition-all disabled:opacity-60"
                >
                  {signupMutation.isPending ? "Creating Account..." : "Create Account"}
                </button>
              </>
            )}
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-semibold text-indigo-600 hover:underline focus:outline-none"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
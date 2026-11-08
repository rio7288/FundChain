
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/auth";
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import "../styles/auth.css";

export default function Register() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        fullName: "",
        username: "",
        email: "",
        password: ""
    });

    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm((previous) => ({
            ...previous,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setMessageType("");

        if (form.password !== confirmPassword) {
            setMessage("Your passwords do not match.");
            setMessageType("error");
            return;
        }

        if (form.password.length < 8) {
            setMessage("Your password must contain at least 8 characters.");
            setMessageType("error");
            return;
        }

        if (!acceptedTerms) {
            setMessage("Please accept the terms before creating your account.");
            setMessageType("error");
            return;
        }

        setLoading(true);

        try {
            const data = await registerUser(form);

            setMessage(
                data.session
                    ? "Registration successful! You can now continue to your account."
                    : "Registration successful! Please verify your email before logging in."
            );

            setMessageType("success");

            if (data.session) {
                setTimeout(() => navigate("/dashboard"), 1200);
            }
        } catch (error) {
            setMessage(error.message || "Registration failed. Please try again.");
            setMessageType("error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">

            {/* Editorial left panel */}
            <section className="auth-story">
                <Link to="/" className="auth-brand">
                    <span className="auth-brand-mark">F</span>
                    <span>FundChain</span>
                </Link>

                <div className="auth-story-content">
                    <p className="auth-eyebrow">
                        A COMMUNITY BUILT ON BELIEF
                    </p>

                    <h1>
                        Every meaningful idea starts with someone who believes.
                    </h1>

                    <p className="auth-story-description">
                        Find the people who believe in your idea.
                        Build something meaningful together, one step at a time.
                    </p>
                </div>

                <div className="auth-story-bottom">
                    <span>Ideas deserve a chance to become reality.</span>
                    <span>01 — 04</span>
                </div>

                <div className="auth-decoration auth-decoration-one" />
                <div className="auth-decoration auth-decoration-two" />
            </section>

            {/* Registration form */}
            <section className="auth-form-section">
                <div className="auth-mobile-brand">
                    <Link to="/" className="auth-brand">
                        <span className="auth-brand-mark">F</span>
                        <span>FundChain</span>
                    </Link>
                </div>

                <div className="auth-form-wrapper">

                    <div className="auth-form-heading">
                        <p className="auth-eyebrow">YOUR JOURNEY STARTS HERE</p>
                        <h2>Create your account.</h2>
                        <p>
                            Join a community turning meaningful ideas
                            into something real.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">

                        <div className="auth-field">
                            <label htmlFor="fullName">Full name</label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                placeholder="Enter your full name"
                                value={form.fullName}
                                onChange={handleChange}
                                autoComplete="name"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="Choose a username"
                                value={form.username}
                                onChange={handleChange}
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="password">Password</label>

                            <div className="auth-password-wrap">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="At least 8 characters"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />

                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="confirmPassword">Confirm password</label>

                            <div className="auth-password-wrap">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Enter your password again"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    onClick={() =>
                                        setShowConfirmPassword(!showConfirmPassword)
                                    }
                                    aria-label={
                                        showConfirmPassword
                                            ? "Hide confirm password"
                                            : "Show confirm password"
                                    }
                                >
                                    {showConfirmPassword
                                        ? <EyeOff size={18} />
                                        : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <label className="auth-terms">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            <span>
                                I agree to the FundChain terms and conditions.
                            </span>
                        </label>

                        {message && (
                            <div
                                className={`auth-message ${
                                    messageType === "success"
                                        ? "auth-message-success"
                                        : "auth-message-error"
                                }`}
                                role="alert"
                            >
                                {messageType === "success" && (
                                    <CheckCircle2 size={18} />
                                )}
                                <span>{message}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={loading}
                        >
                            {loading ? "Creating your account..." : "Create account"}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="auth-switch">
                        Already have an account?
                        <Link to="/login"> Sign in</Link>
                    </div>

                    <p className="auth-form-footer">
                        By creating an account, you can participate in the
                        FundChain community.
                    </p>
                </div>
            </section>
        </main>
    );
}

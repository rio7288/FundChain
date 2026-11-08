
import { useState } from "react";
import {
    Link,
    useNavigate,
    useLocation
} from "react-router-dom";

import { loginUser } from "../services/auth";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import "../styles/auth.css";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Remember the page the user originally wanted to visit.
    const redirectTo =
        location.state?.from?.pathname || "/dashboard";

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            await loginUser(email, password);

            // Return to the requested page after successful login.
            navigate(redirectTo, { replace: true });

        } catch (error) {
            setMessage(
                error.message || "Unable to sign in. Please try again."
            );
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
                        IDEAS BRING US TOGETHER
                    </p>

                    <h1>
                        Every meaningful idea starts with someone who believes.
                    </h1>

                    <p className="auth-story-description">
                        Welcome back to a community built around
                        meaningful ideas, shared belief and collective impact.
                    </p>
                </div>

                <div className="auth-story-bottom">
                    <span>Good things happen when we build together.</span>
                    <span>02 — 04</span>
                </div>

                <div className="auth-decoration auth-decoration-one" />
                <div className="auth-decoration auth-decoration-two" />

            </section>

            {/* Login form */}
            <section className="auth-form-section">

                <div className="auth-mobile-brand">
                    <Link to="/" className="auth-brand">
                        <span className="auth-brand-mark">F</span>
                        <span>FundChain</span>
                    </Link>
                </div>

                <div className="auth-form-wrapper">

                    <div className="auth-form-heading">
                        <p className="auth-eyebrow">
                            WELCOME BACK
                        </p>

                        <h2>Good to have you back.</h2>

                        <p>
                            Sign in to continue your FundChain journey.
                        </p>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="auth-form"
                    >

                        <div className="auth-field">
                            <label htmlFor="login-email">
                                Email address
                            </label>

                            <input
                                id="login-email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="auth-field">

                            <div className="auth-label-row">
                                <label htmlFor="login-password">
                                    Password
                                </label>

                                <Link to="/forgot-password">
                                    Forgot password?
                                </Link>
                            </div>

                            <div className="auth-password-wrap">
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword
                                        ? <EyeOff size={18} />
                                        : <Eye size={18} />
                                    }
                                </button>
                            </div>
                        </div>

                        {message && (
                            <div
                                className="auth-message auth-message-error"
                                role="alert"
                            >
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Sign in"}

                            {!loading && <ArrowRight size={18} />}
                        </button>

                    </form>

                    <div className="auth-switch">
                        New to FundChain?
                        <Link to="/register"> Create an account</Link>
                    </div>

                    <p className="auth-form-footer">
                        Your next meaningful contribution could start here.
                    </p>

                </div>
            </section>
        </main>
    );
}

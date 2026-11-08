import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/auth";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            await forgotPassword(email);

            setMessage("Password reset email sent! Check your inbox.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={container}>
            <form onSubmit={handleSubmit} style={card}>
                <h1>Forgot Password?</h1>
                <p>Enter your registered email address.</p>

                <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={input}
                />

                <button disabled={loading} style={button}>
                    {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <p>{message}</p>

                <Link to="/login">Back to Login</Link>
            </form>
        </div>
    );
}

const container = {
    minHeight: "100vh",
    background: "#090D18",
    color: "white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
};

const card = {
    background: "#151C2E",
    padding: 35,
    borderRadius: 16,
    width: "100%",
    maxWidth: 400
};

const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: 13,
    marginTop: 15,
    background: "#0F172A",
    color: "white",
    border: "1px solid #334155",
    borderRadius: 8
};

const button = {
    width: "100%",
    padding: 14,
    marginTop: 20,
    background: "#7C3AED",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer"
};
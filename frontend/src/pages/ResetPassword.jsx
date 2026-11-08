import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword } from "../services/auth";

export default function ResetPassword() {
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            await updatePassword(password);

            setMessage("Password updated successfully!");

            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#090D18",
            color: "white",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}>
            <form onSubmit={handleSubmit} style={{
                background: "#151C2E",
                padding: 35,
                borderRadius: 16,
                width: "90%",
                maxWidth: 400
            }}>
                <h1>Reset Password</h1>

                <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: 13,
                        marginTop: 15,
                        background: "#0F172A",
                        color: "white",
                        border: "1px solid #334155",
                        borderRadius: 8
                    }}
                />

                <button
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: 14,
                        marginTop: 20,
                        background: "#7C3AED",
                        color: "white",
                        border: "none",
                        borderRadius: 8
                    }}
                >
                    {loading ? "Updating..." : "Update Password"}
                </button>

                <p>{message}</p>
            </form>
        </div>
    );
}
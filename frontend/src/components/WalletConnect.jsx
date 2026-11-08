
import { useState } from "react";
import { connectAndVerifyWallet } from "../services/wallet";

export default function WalletConnect() {
    const [wallet, setWallet] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");

    const handleConnect = async () => {
        if (loading) return;

        setLoading(true);
        setMessage("");
        setMessageType("");

        try {
            const result = await connectAndVerifyWallet();

            setWallet(result.walletAddress);

            setMessage(
                result.alreadyLinked
                    ? "This wallet is already linked to your account."
                    : "Wallet successfully linked to FundChain!"
            );

            setMessageType("success");

        } catch (error) {
            setMessage(error.message || "Wallet connection failed.");
            setMessageType("error");

        } finally {
            setLoading(false);
        }
    };

    const hideWallet = () => {
        setWallet("");
        setMessage("Wallet hidden from this display. It is still linked to your account.");
        setMessageType("info");
    };

    return (
        <div
            style={{
                background: "#151C2E",
                color: "white",
                padding: "25px",
                borderRadius: "14px",
                marginTop: "25px",
                maxWidth: "500px"
            }}
        >
            <h2>Wallet Connection</h2>

            {wallet ? (
                <>
                    <p>Connected wallet:</p>

                    <p
                        style={{
                            color: "#A78BFA",
                            overflowWrap: "anywhere"
                        }}
                    >
                        {wallet}
                    </p>

                    <button
                        onClick={hideWallet}
                        style={buttonStyle}
                    >
                        Hide wallet
                    </button>
                </>
            ) : (
                <button
                    onClick={handleConnect}
                    disabled={loading}
                    style={{
                        ...buttonStyle,
                        opacity: loading ? 0.7 : 1,
                        cursor: loading ? "not-allowed" : "pointer"
                    }}
                >
                    {loading ? "Connecting..." : "Connect MetaMask"}
                </button>
            )}

            {message && (
                <p
                    style={{
                        marginTop: "15px",
                        color:
                            messageType === "success"
                                ? "#4ADE80"
                                : messageType === "error"
                                    ? "#F87171"
                                    : "#A78BFA",
                        overflowWrap: "anywhere"
                    }}
                >
                    {message}
                </p>
            )}
        </div>
    );
}

const buttonStyle = {
    background: "#7C3AED",
    color: "white",
    padding: "13px 22px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
};

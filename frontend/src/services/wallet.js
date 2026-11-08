import { BrowserProvider } from "ethers";
import { supabase } from "./supabase";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const SEPOLIA_CHAIN_ID = 11155111;

async function authenticatedRequest(endpoint, body) {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("Please log in first.");
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Wallet request failed");
    }

    return result;
}

export async function connectAndVerifyWallet() {
    if (!window.ethereum) {
        throw new Error("Please install MetaMask.");
    }

    const provider = new BrowserProvider(window.ethereum);

    await provider.send("eth_requestAccounts", []);

    let network = await provider.getNetwork();

    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        try {
            await provider.send("wallet_switchEthereumChain", [
                { chainId: "0xaa36a7" }
            ]);
        } catch (error) {
            if (error.code === 4902) {
                await provider.send("wallet_addEthereumChain", [{
                    chainId: "0xaa36a7",
                    chainName: "Sepolia Test Network",
                    nativeCurrency: {
                        name: "Sepolia ETH",
                        symbol: "ETH",
                        decimals: 18
                    },
                    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"]
                }]);
            } else {
                throw error;
            }
        }
    }

    network = await provider.getNetwork();

    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Please switch to Sepolia.");
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Ask backend for a signed verification challenge
    const challenge = await authenticatedRequest(
        "/wallet/nonce",
        {
            address,
            chainId: Number(network.chainId)
        }
    );

    // User signs the challenge using MetaMask
    const signature = await signer.signMessage(challenge.message);

    // Backend verifies the signature and links the wallet
    const result = await authenticatedRequest(
        "/wallet/verify",
        {
            address,
            signature,
            message: challenge.message
        }
    );

    return result;
}
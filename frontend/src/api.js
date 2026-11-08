
const API_URL = (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV
        ? "http://localhost:5000/api/v1"
        : "")
).replace(/\/+$/, "");

if (!API_URL) {
    throw new Error(
        "Missing VITE_API_URL. Configure it in your deployment environment."
    );
}

export async function checkBackend() {
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) {
        throw new Error("Backend connection failed");
    }

    return response.json();
}

export { API_URL };

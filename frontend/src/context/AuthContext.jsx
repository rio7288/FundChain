
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";

import { supabase } from "../services/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    const authEventReceived = useRef(false);

    useEffect(() => {
        let mounted = true;

        // Listen for login, logout and session changes.
        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            authEventReceived.current = true;

            if (mounted) {
                setSession(newSession);
                setLoading(false);
            }
        });

        // Explicitly check the existing Supabase session.
        supabase.auth.getSession().then(({ data, error }) => {
            if (!mounted) return;

            if (error) {
                console.error("Session loading error:", error.message);
            }

            // Do not overwrite a newer authentication event.
            if (!authEventReceived.current) {
                setSession(data?.session ?? null);
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                loading
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
}
